import Phaser from 'phaser'
import { gameState } from '../GameState'
import { tradingSystem } from '../systems/TradingSystem'
import { npcManager } from '../systems/NPCManager'
import { marketData } from '../systems/MarketDataEngine'
import { negotiate, buildRelationshipHistory } from '../../services/api'
import { TRADING_NPCS } from '../data/traders'
import type { TraderDef, NPCQuote, ChatMessage, TradeRecord } from '../types'

export class TradingUIScene extends Phaser.Scene {
  private dialogOpen = false
  private dialogContainer!: Phaser.GameObjects.Container
  private activeTrader: TraderDef | null = null
  private activeQuote: NPCQuote | null = null
  private dialogTexts: Map<string, Phaser.GameObjects.Text> = new Map()

  private hudContainer!: Phaser.GameObjects.Container
  private hudTexts: Map<string, Phaser.GameObjects.Text> = new Map()

  private flattenBtn!: Phaser.GameObjects.Rectangle
  private flattenLabel!: Phaser.GameObjects.Text

  private cheatContainer!: Phaser.GameObjects.Container
  private cheatVisible = false
  private historyContainer!: Phaser.GameObjects.Container
  private historyVisible = false

  private escKey!: Phaser.Input.Keyboard.Key
  private buyKey!: Phaser.Input.Keyboard.Key
  private sellKey!: Phaser.Input.Keyboard.Key
  private flattenKey!: Phaser.Input.Keyboard.Key
  private cheatKeyHandler!: (e: KeyboardEvent) => void

  // Chat state
  private chatContainer!: Phaser.GameObjects.Container
  private chatMask!: Phaser.Display.Masks.GeometryMask
  private chatMessages: Phaser.GameObjects.Text[] = []
  private chatInput: HTMLInputElement | null = null
  private sendBtn!: Phaser.GameObjects.Rectangle
  private sendLabel!: Phaser.GameObjects.Text
  private conversationHistory: ChatMessage[] = []
  private sessionTrades: TradeRecord[] = []
  private isNegotiating = false
  private thinkingText: Phaser.GameObjects.Text | null = null

  // Original bid/ask for this dialog session (before any negotiation)
  private originalBid = 0
  private originalAsk = 0

  // Ticker scroller
  private tickerScrollContainer!: Phaser.GameObjects.Container
  private tickerScrollWidth = 0

  constructor() {
    super('TradingUIScene')
  }

  create(): void {
    this.buildTradeDialog()
    this.buildHUD()
    this.buildTickerScroller()

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.buyKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B)
    this.sellKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.flattenKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)

    this.escKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen || this.isChatFocused()) return
      if (this.historyVisible) {
        this.historyVisible = false
        this.historyContainer.setVisible(false)
        return
      }
      if (this.cheatVisible) {
        this.cheatVisible = false
        this.cheatContainer.setVisible(false)
        this.setChatInputVisible(true)
        return
      }
      this.closeTradeDialog()
    })

    this.buyKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen || this.isChatFocused()) return
      this.executeTrade('BUY')
    })

    this.sellKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen || this.isChatFocused()) return
      this.executeTrade('SELL')
    })

    this.flattenKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen || this.isChatFocused()) return
      this.executeFlatten()
    })

    // Cmd+/ cheat, H history, Cmd+T toggle chat input focus
    this.cheatKeyHandler = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey) && this.dialogOpen) {
        e.preventDefault()
        this.toggleCheat()
      }
      if ((e.key === 'h' || e.key === 'H') && this.cheatVisible && this.dialogOpen && !this.isChatFocused()) {
        e.preventDefault()
        this.toggleHistory()
      }
    }
    window.addEventListener('keydown', this.cheatKeyHandler)

    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.cheatKeyHandler)
      this.removeChatInput()
    })
  }

  private isChatFocused(): boolean {
    return document.activeElement === this.chatInput
  }

  public isDialogOpen(): boolean {
    return this.dialogOpen
  }

  public openTradeDialog(trader: TraderDef): void {
    if (!trader.ticker) return

    this.activeTrader = trader
    this.activeQuote = npcManager.generateQuote(trader)
    if (!this.activeQuote) return

    this.originalBid = this.activeQuote.bid
    this.originalAsk = this.activeQuote.ask

    this.dialogOpen = true
    this.conversationHistory = []
    this.sessionTrades = []
    this.isNegotiating = false

    this.dialogTexts.get('name')!.setText(`${trader.nickname} — ${trader.name}`)
    this.dialogTexts.get('quote')!.setText(npcManager.formatQuote(trader, this.activeQuote))
    this.dialogTexts.get('weakness')!.setText(`WEAKNESS: ${trader.weakness}`)
    this.dialogTexts.get('result')!.setText('')

    // Reset cheat + history overlays
    this.cheatVisible = false
    this.cheatContainer.setVisible(false)
    this.historyVisible = false
    this.historyContainer.setVisible(false)
    this.updateCheatInfo()

    this.updateTradeInfo()

    // Clear previous chat messages
    this.clearChatMessages()

    // Add greeting as first NPC message
    this.addChatMessage('npc', trader.greeting)
    this.conversationHistory.push({ role: 'npc', content: trader.greeting })

    this.dialogContainer.setVisible(true)
    this.createChatInput()
    // Auto-focus the chat input on dialog open
    this.time.delayedCall(50, () => {
      this.chatInput?.focus()
    })
  }

  public closeTradeDialog(): void {
    // Save interaction to NPC memory
    if (this.activeTrader && this.activeTrader.ticker) {
      this.saveInteractionToMemory()
    }

    this.dialogOpen = false
    this.dialogContainer.setVisible(false)
    this.removeChatInput()
    this.activeTrader = null
    this.activeQuote = null
  }

  public refreshHUD(): void {
    if (this.hudTexts.size === 0) return
    this.updateHUD()
  }

  private saveInteractionToMemory(): void {
    if (!this.activeTrader || !this.activeTrader.ticker) return
    // Only save if there was actual conversation (beyond the greeting)
    if (this.conversationHistory.length <= 1 && this.sessionTrades.length === 0) return

    const npcId = this.activeTrader.id
    const ticker = this.activeTrader.ticker
    const currentPrice = marketData.getPrice(ticker) ?? 0

    const entry = {
      day: gameState.dayNumber,
      date: gameState.currentDate,
      conversation: [...this.conversationHistory],
      tradesExecuted: [...this.sessionTrades],
      priceAtTime: currentPrice,
      nextDayPrice: null as number | null,
      ticker,
    }

    if (!gameState.npcMemory.has(npcId)) {
      gameState.npcMemory.set(npcId, [])
    }
    gameState.npcMemory.get(npcId)!.push(entry)
  }

  private buildTradeDialog(): void {
    const cw = this.scale.width
    const ch = this.scale.height
    const dw = 700
    const dh = 500

    this.dialogContainer = this.add.container(cw / 2, ch / 2)
    this.dialogContainer.setDepth(1000)
    this.dialogContainer.setVisible(false)

    const backdrop = this.add.rectangle(0, 0, cw, ch, 0x000000, 0.6)
    this.dialogContainer.add(backdrop)

    const panel = this.add.rectangle(0, 0, dw, dh, 0x1a1a2e, 0.95)
    panel.setStrokeStyle(2, 0x334155)
    this.dialogContainer.add(panel)

    // Trader name
    const nameText = this.add
      .text(0, -dh / 2 + 25, '', {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(nameText)
    this.dialogTexts.set('name', nameText)

    // Quote
    const quoteText = this.add
      .text(0, -dh / 2 + 55, '', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(quoteText)
    this.dialogTexts.set('quote', quoteText)

    // Trader weakness - prominent display
    const weaknessText = this.add
      .text(0, -dh / 2 + 85, '', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#f472b6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(weaknessText)
    this.dialogTexts.set('weakness', weaknessText)

    // Chat area - masked scrollable region
    const chatAreaX = -dw / 2 + 25
    const chatAreaY = -dh / 2 + 110
    const chatAreaW = dw - 50
    const chatAreaH = 180

    // Chat background
    const chatBg = this.add.rectangle(0, chatAreaY + chatAreaH / 2, chatAreaW, chatAreaH, 0x0f0f23, 0.9)
    chatBg.setStrokeStyle(1, 0x334155)
    this.dialogContainer.add(chatBg)

    // Chat message container (will be masked)
    this.chatContainer = this.add.container(chatAreaX + 10, chatAreaY + 5)
    this.dialogContainer.add(this.chatContainer)

    // Create geometry mask for chat area
    const maskShape = this.make.graphics({ x: 0, y: 0 })
    // Convert local dialog coords to screen coords for the mask
    const maskX = cw / 2 + chatAreaX
    const maskY = ch / 2 + chatAreaY
    maskShape.fillRect(maskX, maskY, chatAreaW, chatAreaH)
    this.chatMask = maskShape.createGeometryMask()
    this.chatContainer.setMask(this.chatMask)

    // Send button (positioned inside dialog)
    const sendBtnX = dw / 2 - 55
    const sendBtnY = chatAreaY + chatAreaH + 22
    this.sendBtn = this.add.rectangle(sendBtnX, sendBtnY, 60, 26, 0x3b82f6)
    this.sendBtn.setInteractive({ useHandCursor: true })
    this.sendBtn.on('pointerover', () => this.sendBtn.setAlpha(0.8))
    this.sendBtn.on('pointerout', () => this.sendBtn.setAlpha(1))
    this.sendBtn.on('pointerdown', () => this.onSendMessage())
    this.dialogContainer.add(this.sendBtn)

    this.sendLabel = this.add
      .text(sendBtnX, sendBtnY, 'SEND', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(this.sendLabel)

    // Trade info
    const notionalLabel = this.add
      .text(0, dh / 2 - 140, '', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(notionalLabel)
    this.dialogTexts.set('notional', notionalLabel)

    const costText = this.add
      .text(0, dh / 2 - 115, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(costText)
    this.dialogTexts.set('cost', costText)

    // Action buttons
    const btnY = dh / 2 - 70
    const btnW = 145
    const btnH = 40

    this.createDialogButton(-btnW - 8, btnY, btnW, btnH, 'SELL / SHORT (S)', 0xdc2626, () =>
      this.executeTrade('SELL')
    )
    this.createDialogButton(0, btnY, btnW, btnH, 'BUY / LONG (B)', 0x16a34a, () =>
      this.executeTrade('BUY')
    )
    this.createDialogButton(btnW + 8, btnY, btnW, btnH, 'WALK AWAY (ESC)', 0x475569, () =>
      this.closeTradeDialog()
    )

    // Flatten button
    const flattenY = btnY + btnH / 2 + 18
    this.flattenBtn = this.add.rectangle(0, flattenY, 200, 22, 0x854d0e)
    this.flattenBtn.setInteractive({ useHandCursor: true })
    this.flattenBtn.on('pointerover', () => this.flattenBtn.setAlpha(0.8))
    this.flattenBtn.on('pointerout', () => this.flattenBtn.setAlpha(1))
    this.flattenBtn.on('pointerdown', () => this.executeFlatten())
    this.dialogContainer.add(this.flattenBtn)

    this.flattenLabel = this.add
      .text(0, flattenY, 'FLATTEN (F)', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(this.flattenLabel)

    // Result text
    const resultText = this.add
      .text(0, dh / 2 - 10, '', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#4ade80',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(resultText)
    this.dialogTexts.set('result', resultText)

    // Cheat button
    const cheatBtn = this.add.rectangle(dw / 2 - 18, dh / 2 - 18, 24, 24, 0x7c3aed, 0.8)
    cheatBtn.setInteractive({ useHandCursor: true })
    cheatBtn.on('pointerover', () => cheatBtn.setAlpha(0.6))
    cheatBtn.on('pointerout', () => cheatBtn.setAlpha(1))
    cheatBtn.on('pointerdown', () => this.toggleCheat())
    this.dialogContainer.add(cheatBtn)

    const cheatBtnLabel = this.add
      .text(dw / 2 - 18, dh / 2 - 18, '?', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#e9d5ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(cheatBtnLabel)

    // Cheat info overlay (full modal like history)
    this.cheatContainer = this.add.container(0, 0)
    this.cheatContainer.setVisible(false)

    const cheatBg = this.add.rectangle(0, 0, dw - 20, dh - 20, 0x1e1b4b, 0.97)
    cheatBg.setStrokeStyle(1, 0x7c3aed)
    this.cheatContainer.add(cheatBg)

    const cheatTitle = this.add
      .text(0, -dh / 2 + 25, 'CHEAT SHEET', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#a78bfa',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.cheatContainer.add(cheatTitle)

    const cheatInfo = this.add
      .text(0, -dh / 2 + 55, '', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#e9d5ff',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0)
    this.cheatContainer.add(cheatInfo)
    this.dialogTexts.set('cheatInfo', cheatInfo)

    this.dialogContainer.add(this.cheatContainer)

    // History overlay (toggled with H when cheat sheet is open)
    this.historyContainer = this.add.container(0, 0)
    this.historyContainer.setVisible(false)

    const histBg = this.add.rectangle(0, 0, dw - 20, dh - 20, 0x0a0a1a, 0.97)
    histBg.setStrokeStyle(1, 0x7c3aed)
    this.historyContainer.add(histBg)

    const histTitle = this.add
      .text(0, -dh / 2 + 25, 'RELATIONSHIP HISTORY CONTEXT (H to close)', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#a78bfa',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.historyContainer.add(histTitle)

    const histText = this.add
      .text(-dw / 2 + 30, -dh / 2 + 45, '', {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#c4b5fd',
        wordWrap: { width: dw - 60 },
        lineSpacing: 3,
      })
    this.historyContainer.add(histText)
    this.dialogTexts.set('historyInfo', histText)

    this.dialogContainer.add(this.historyContainer)
  }

  private createChatInput(): void {
    this.removeChatInput()

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Type your message...'
    input.style.cssText = `
      position: fixed;
      font-family: monospace;
      font-size: 13px;
      color: #e2e8f0;
      background: #1a1a2e;
      border: 1px solid #334155;
      border-radius: 3px;
      padding: 4px 8px;
      outline: none;
      box-sizing: border-box;
      z-index: 1000;
    `

    this.positionChatInput(input)

    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter' && !this.isNegotiating) {
        this.onSendMessage()
      }
      if (e.key === 'Escape') {
        input.blur()
      }
    })

    document.body.appendChild(input)
    this.chatInput = input

    // Reposition on window resize (canvas scale changes)
    this._resizeHandler = () => this.positionChatInput(input)
    window.addEventListener('resize', this._resizeHandler)
  }

  private _resizeHandler: (() => void) | null = null

  private positionChatInput(input: HTMLInputElement): void {
    const canvas = this.game.canvas
    const canvasRect = canvas.getBoundingClientRect()
    const scaleX = canvasRect.width / this.scale.width
    const scaleY = canvasRect.height / this.scale.height

    const dw = 700
    const dh = 500
    const chatAreaH = 180
    const chatAreaW = dw - 50

    // Game-space coordinates (origin = top-left of game canvas)
    const gameX = (this.scale.width - dw) / 2 + 25
    const gameY = (this.scale.height - dh) / 2 + 110 + chatAreaH + 10
    const gameW = chatAreaW - 70
    const gameH = 26

    // Convert game-space to screen-space
    input.style.left = `${canvasRect.left + gameX * scaleX}px`
    input.style.top = `${canvasRect.top + gameY * scaleY}px`
    input.style.width = `${gameW * scaleX}px`
    input.style.height = `${gameH * scaleY}px`
    input.style.fontSize = `${Math.max(11, 13 * scaleY)}px`
  }

  private removeChatInput(): void {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler)
      this._resizeHandler = null
    }
    if (this.chatInput) {
      this.chatInput.remove()
      this.chatInput = null
    }
  }

  private clearChatMessages(): void {
    for (const msg of this.chatMessages) {
      msg.destroy()
    }
    this.chatMessages = []
    // Reset container to original position (dialog-local coords)
    const dh = 500
    this.chatContainer.setPosition(this.chatContainer.x, -dh / 2 + 110 + 5)
  }

  private addChatMessage(role: 'npc' | 'user', text: string): void {
    const dw = 700
    const chatAreaW = dw - 50 - 20 // padding

    const prefix = role === 'npc' ? `[${this.activeTrader?.nickname ?? 'NPC'}]` : '[You]'
    const color = role === 'npc' ? '#facc15' : '#94a3b8'

    // Calculate Y position based on existing messages
    let yPos = 0
    if (this.chatMessages.length > 0) {
      const lastMsg = this.chatMessages[this.chatMessages.length - 1]
      yPos = lastMsg.y + lastMsg.height + 6
    }

    const msgText = this.add.text(0, yPos, `${prefix} ${text}`, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color,
      wordWrap: { width: chatAreaW },
      lineSpacing: 2,
    })

    this.chatContainer.add(msgText)
    this.chatMessages.push(msgText)

    // Auto-scroll: shift container up if messages overflow
    const chatAreaH = 180
    const totalHeight = yPos + msgText.height
    if (totalHeight > chatAreaH - 10) {
      const overflow = totalHeight - (chatAreaH - 10)
      // Move all messages up by adjusting the container's local offset
      for (const m of this.chatMessages) {
        m.y -= overflow
      }
    }
  }

  private async onSendMessage(): Promise<void> {
    if (!this.chatInput || !this.activeTrader || !this.activeQuote || this.isNegotiating) return
    const message = this.chatInput.value.trim()
    if (!message) return

    this.chatInput.value = ''
    this.isNegotiating = true
    this.chatInput.disabled = true

    // Add user message to chat
    this.addChatMessage('user', message)
    this.conversationHistory.push({ role: 'user', content: message })

    // Show thinking indicator
    this.showThinking()

    try {
      const response = await negotiate({
        trader_id: this.activeTrader.id,
        trader_name: this.activeTrader.name,
        trader_personality: this.activeTrader.personality,
        trader_weakness: this.activeTrader.weakness,
        ticker: this.activeTrader.ticker!,
        current_bid: this.originalBid,
        current_ask: this.originalAsk,
        message,
        conversation_history: this.conversationHistory.slice(0, -1), // exclude current message (backend adds it)
        relationship_history: buildRelationshipHistory(this.activeTrader.id),
      })

      this.hideThinking()

      // Add NPC response to chat
      this.addChatMessage('npc', response.npc_message)
      this.conversationHistory.push({ role: 'npc', content: response.npc_message })

      // Update quote whenever the returned prices differ from current
      const bidChanged = response.updated_bid !== this.activeQuote.bid
      const askChanged = response.updated_ask !== this.activeQuote.ask
      if (bidChanged || askChanged) {
        this.activeQuote.bid = response.updated_bid
        this.activeQuote.ask = response.updated_ask
        this.activeQuote.spread = response.updated_ask - response.updated_bid

        // Update displayed quote with flash effect
        const quoteText = this.dialogTexts.get('quote')!
        quoteText.setText(npcManager.formatQuote(this.activeTrader, this.activeQuote))
        quoteText.setColor('#4ade80')
        this.time.delayedCall(1500, () => {
          quoteText.setColor('#e2e8f0')
        })

        this.updateTradeInfo()
      }
    } catch (err) {
      this.hideThinking()
      this.addChatMessage('npc', '*scratches head* ...gimme a sec, kid.')
    }

    this.isNegotiating = false
    if (this.chatInput) {
      this.chatInput.disabled = false
      this.chatInput.focus()
    }
  }

  private showThinking(): void {
    let yPos = 0
    if (this.chatMessages.length > 0) {
      const lastMsg = this.chatMessages[this.chatMessages.length - 1]
      yPos = lastMsg.y + lastMsg.height + 6
    }

    this.thinkingText = this.add.text(0, yPos, '...', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#64748b',
    })
    this.chatContainer.add(this.thinkingText)
  }

  private hideThinking(): void {
    if (this.thinkingText) {
      this.thinkingText.destroy()
      this.thinkingText = null
    }
  }

  private createDialogButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    callback: () => void
  ): void {
    const btn = this.add.rectangle(x, y, w, h, color)
    btn.setInteractive({ useHandCursor: true })
    btn.on('pointerover', () => btn.setAlpha(0.8))
    btn.on('pointerout', () => btn.setAlpha(1))
    btn.on('pointerdown', callback)

    const text = this.add
      .text(x, y, label, {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.dialogContainer.add(btn)
    this.dialogContainer.add(text)
  }

  private updateTradeInfo(): void {
    if (!this.activeQuote || !this.activeTrader) return

    const ticker = this.activeTrader.ticker!
    const notional = gameState.tradeNotional
    const buyQty = tradingSystem.getTradeQuantity(this.activeQuote.ask)
    const sellQty = tradingSystem.getTradeQuantity(this.activeQuote.bid)

    this.dialogTexts.get('notional')!.setText(`$${this.fmt(notional)} per trade`)

    const buyExposure = tradingSystem.getProjectedPositionMarketValue(
      ticker,
      buyQty,
      this.activeQuote.ask
    )
    const sellExposure = tradingSystem.getProjectedPositionMarketValue(
      ticker,
      -sellQty,
      this.activeQuote.bid
    )

    this.dialogTexts
      .get('cost')!
      .setText(
        `Buy: ${this.fmt(buyQty)} shares  |  Sell: ${this.fmt(sellQty)} shares\nNext exposure — Buy: ${this.formatSignedDollars(buyExposure)}  |  Sell: ${this.formatSignedDollars(sellExposure)}`
      )

    // Show flatten button only when holding a position in this ticker
    const pos = gameState.positions.get(ticker)
    const hasPosition = !!pos && pos.quantity !== 0
    this.flattenBtn.setVisible(hasPosition)
    this.flattenLabel.setVisible(hasPosition)
    if (hasPosition) {
      const side = pos!.quantity > 0 ? 'LONG' : 'SHORT'
      const qty = Math.abs(pos!.quantity)
      this.flattenLabel.setText(`FLATTEN ${side} ${this.fmt(qty)} (F)`)
    }
  }

  private executeTrade(side: 'BUY' | 'SELL'): void {
    if (!this.activeTrader || !this.activeQuote) return

    const price = side === 'BUY' ? this.activeQuote.ask : this.activeQuote.bid
    const ticker = this.activeTrader.ticker!
    const quantity = tradingSystem.getTradeQuantity(price)

    let success = false
    if (side === 'BUY') {
      success = tradingSystem.buy(ticker, price, this.activeTrader.id, this.activeTrader.nickname)
    } else {
      success = tradingSystem.sell(ticker, price, this.activeTrader.id, this.activeTrader.nickname)
    }

    const resultText = this.dialogTexts.get('result')!
    if (success) {
      const verb = side === 'BUY' ? 'Bought' : 'Sold'
      resultText.setColor('#4ade80')
      resultText.setText(
        `${verb} ${this.fmt(quantity)} ${ticker} @ $${this.fmt(price)} ($${this.fmt(gameState.tradeNotional)})`
      )
      this.sessionTrades.push({ side, quantity, price })
      this.updateTradeInfo()
      this.updateHUD()
    } else {
      resultText.setColor('#f87171')
      resultText.setText('Trade rejected — exposure limit exceeded')
    }
  }

  private executeFlatten(): void {
    if (!this.activeTrader || !this.activeQuote) return

    const ticker = this.activeTrader.ticker!
    const pos = gameState.positions.get(ticker)
    if (!pos || pos.quantity === 0) return

    // Close longs at bid, close shorts at ask
    const price = pos.quantity > 0 ? this.activeQuote.bid : this.activeQuote.ask
    const side = pos.quantity > 0 ? 'LONG' : 'SHORT'
    const flattenSide: 'BUY' | 'SELL' = pos.quantity > 0 ? 'SELL' : 'BUY'
    const closedQty = tradingSystem.flatten(
      ticker,
      price,
      this.activeTrader.id,
      this.activeTrader.nickname
    )

    const resultText = this.dialogTexts.get('result')!
    if (closedQty > 0) {
      const notional = closedQty * price
      resultText.setColor('#fbbf24')
      resultText.setText(
        `Flattened ${side} ${this.fmt(closedQty)} ${ticker} @ $${this.fmt(price)} ($${this.fmt(notional)})`
      )
      this.sessionTrades.push({ side: flattenSide, quantity: closedQty, price })
      this.updateTradeInfo()
      this.updateHUD()
    }
  }

  private toggleCheat(): void {
    this.cheatVisible = !this.cheatVisible
    this.cheatContainer.setVisible(this.cheatVisible)
    if (!this.cheatVisible) {
      this.historyVisible = false
      this.historyContainer.setVisible(false)
    }
    this.setChatInputVisible(!this.cheatVisible)
  }

  private toggleHistory(): void {
    this.historyVisible = !this.historyVisible
    this.historyContainer.setVisible(this.historyVisible)
    if (this.historyVisible && this.activeTrader) {
      const history = buildRelationshipHistory(this.activeTrader.id)
      this.dialogTexts.get('historyInfo')!.setText(history || '(No prior interactions with this trader)')
    }
  }

  private setChatInputVisible(visible: boolean): void {
    if (this.chatInput) {
      this.chatInput.style.display = visible ? '' : 'none'
      if (!visible) this.chatInput.blur()
    }
  }

  private updateCheatInfo(): void {
    if (!this.activeTrader) return

    const trader = this.activeTrader
    const ticker = trader.ticker ?? '—'
    const todayPrice = marketData.getPrice(ticker)
    const tomorrowPrice = marketData.getNextPrice(ticker)
    const spreadPct = { tight: '0.25%', normal: '0.5%', wide: '1%' }[trader.spreadStyle]

    const lines = [
      `${trader.name}  |  ${ticker}`,
      `Spread: ${trader.spreadStyle.toUpperCase()} (~${spreadPct} round-trip)`,
      `Weakness: ${trader.weakness}`,
      `Today close: $${todayPrice?.toFixed(2) ?? '?'}`,
    ]

    if (todayPrice != null && tomorrowPrice != null) {
      const chg = tomorrowPrice - todayPrice
      const chgPct = (chg / todayPrice) * 100
      const sign = chg >= 0 ? '+' : ''
      lines.push(`Tomorrow: $${tomorrowPrice.toFixed(2)} (${sign}${chgPct.toFixed(2)}%)`)
    } else {
      lines.push('Tomorrow: —')
    }

    lines.push('[H] View relationship history context')

    this.dialogTexts.get('cheatInfo')!.setText(lines.join('\n'))
  }

  private buildHUD(): void {
    const cw = this.scale.width

    this.hudContainer = this.add.container(0, 0)
    this.hudContainer.setDepth(500)

    const hudBg = this.add.rectangle(cw / 2, 0, cw, 72, 0x0a0a1a, 0.88)
    hudBg.setOrigin(0.5, 0)
    this.hudContainer.add(hudBg)

    const capitalText = this.add.text(16, 6, '', {
      fontSize: '15px',
      fontFamily: 'monospace',
      color: '#4ade80',
    })
    this.hudContainer.add(capitalText)
    this.hudTexts.set('capital', capitalText)

    const pnlText = this.add.text(16, 25, '', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#94a3b8',
    })
    this.hudContainer.add(pnlText)
    this.hudTexts.set('pnl', pnlText)

    const exposureText = this.add.text(16, 43, '', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#94a3b8',
    })
    this.hudContainer.add(exposureText)
    this.hudTexts.set('exposure', exposureText)

    const dayText = this.add
      .text(cw / 2, 6, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5, 0)
    this.hudContainer.add(dayText)
    this.hudTexts.set('day', dayText)

    const timerText = this.add
      .text(cw / 2, 25, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5, 0)
    this.hudContainer.add(timerText)
    this.hudTexts.set('timer', timerText)

    const endDayBtn = this.add.rectangle(cw - 60, 4, 100, 18, 0x7f1d1d)
    endDayBtn.setOrigin(0.5, 0)
    endDayBtn.setInteractive({ useHandCursor: true })
    endDayBtn.on('pointerover', () => endDayBtn.setFillStyle(0x991b1b))
    endDayBtn.on('pointerout', () => endDayBtn.setFillStyle(0x7f1d1d))
    endDayBtn.on('pointerdown', () => {
      this.game.events.emit('trading:end-day-early')
    })
    this.hudContainer.add(endDayBtn)

    const endDayLabel = this.add
      .text(cw - 60, 13, 'END DAY (\u2318D)', {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    this.hudContainer.add(endDayLabel)

    const posText = this.add
      .text(cw - 16, 26, '', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#94a3b8',
        align: 'right',
      })
      .setOrigin(1, 0)
    this.hudContainer.add(posText)
    this.hudTexts.set('positions', posText)

    const poweredByText = this.add
      .text(cw / 2, 46, 'Powered by Google Gemini', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#64748b',
      })
      .setOrigin(0.5, 0)
    this.hudContainer.add(poweredByText)

    this.updateHUD()
  }

  private buildTickerScroller(): void {
    const cw = this.scale.width
    const scrollerY = 72
    const scrollerH = 20

    // Background bar
    const scrollerBg = this.add.rectangle(cw / 2, scrollerY + scrollerH / 2, cw, scrollerH, 0x000000, 0.92)
    scrollerBg.setOrigin(0.5)
    this.hudContainer.add(scrollerBg)

    // Top separator
    const line = this.add.rectangle(cw / 2, scrollerY, cw, 1, 0x334155)
    line.setOrigin(0.5, 0.5)
    this.hudContainer.add(line)

    // Build ticker items — start flush left, two copies for seamless looping
    this.tickerScrollContainer = this.add.container(0, scrollerY + scrollerH / 2)
    this.tickerScrollContainer.setDepth(500)

    const gap = 40
    let xPos = 0

    for (let copy = 0; copy < 2; copy++) {
      for (const trader of TRADING_NPCS) {
        const mid = marketData.getPrice(trader.ticker!)
        let isUp: boolean
        if (gameState.dayNumber <= 1) {
          // Day 1: no previous price data, randomize
          isUp = Math.random() > 0.5
        } else {
          const change = marketData.getPriceChange(trader.ticker!)
          isUp = change ? change.change >= 0 : true
        }
        const color = isUp ? '#4ade80' : '#f87171'
        const arrow = isUp ? '\u25B2' : '\u25BC'

        const entry = this.add
          .text(xPos, 0, `${trader.ticker}  $${mid?.toFixed(2) ?? '?'} ${arrow}`, {
            fontSize: '11px',
            fontFamily: 'monospace',
            color,
          })
          .setOrigin(0, 0.5)

        this.tickerScrollContainer.add(entry)
        xPos += entry.width + gap
      }

      // Record width of one full set after first copy
      if (copy === 0) this.tickerScrollWidth = xPos
    }

    // Mask to clip to screen width
    const maskShape = this.make.graphics({})
    maskShape.fillRect(0, scrollerY, cw, scrollerH)
    this.tickerScrollContainer.setMask(maskShape.createGeometryMask())
  }

  update(_time: number, delta: number): void {
    if (!this.tickerScrollContainer) return

    const speed = 60 // pixels per second
    this.tickerScrollContainer.x -= speed * (delta / 1000)

    // When first copy scrolls fully off, reset for seamless loop
    if (this.tickerScrollContainer.x <= -this.tickerScrollWidth) {
      this.tickerScrollContainer.x += this.tickerScrollWidth
    }
  }

  private updateHUD(): void {
    const todayPnl = tradingSystem.getTodayRealizedPnl() + tradingSystem.getUnrealizedPnl()
    const totalPnl = gameState.cumulativePnl + todayPnl
    const capitalText = this.hudTexts.get('capital')!
    const totalSign = totalPnl >= 0 ? '+' : '-'
    capitalText.setText(`P&L: ${totalSign}$${this.fmt(totalPnl)}`)
    capitalText.setColor(totalPnl >= 0 ? '#4ade80' : '#f87171')

    const pnlText = this.hudTexts.get('pnl')!
    const todaySign = todayPnl >= 0 ? '+' : '-'
    pnlText.setText(`Today: ${todaySign}$${this.fmt(todayPnl)}`)
    pnlText.setColor(todayPnl >= 0 ? '#4ade80' : '#f87171')

    const netExposure = tradingSystem.getNetMarketExposure()
    const grossExposure = tradingSystem.getGrossMarketExposure()
    this.hudTexts
      .get('exposure')!
      .setText(`Net Exp: ${this.formatSignedDollars(netExposure)}  Gross: $${this.fmt(grossExposure)}`)

    this.hudTexts.get('day')!.setText(`${marketData.formatDate(gameState.currentDate)} (${gameState.dayNumber})`)

    const mins = Math.floor(gameState.tradingTimeRemaining / 60)
    const secs = gameState.tradingTimeRemaining % 60
    const timerText = this.hudTexts.get('timer')!
    timerText.setText(`${mins}:${secs.toString().padStart(2, '0')} mins till close`)
    if (gameState.tradingTimeRemaining <= 30) {
      timerText.setColor('#f87171')
    } else if (gameState.tradingTimeRemaining <= 60) {
      timerText.setColor('#fb923c')
    } else {
      timerText.setColor('#facc15')
    }

    const posLines: string[] = []
    for (const pos of gameState.positions.values()) {
      const side = pos.quantity >= 0 ? 'LONG' : 'SHORT'
      const marketValue = tradingSystem.getPositionMarketValue(pos.ticker)
      posLines.push(
        `${pos.ticker} ${side} ${this.fmt(Math.abs(pos.quantity))} | MV ${this.formatSignedDollars(marketValue)}`
      )
    }
    if (posLines.length === 0) {
      this.hudTexts.get('positions')!.setText('No open positions')
      return
    }

    const visibleLines = posLines.slice(0, 4)
    if (posLines.length > 4) {
      visibleLines.push(`... +${posLines.length - 4} more`)
    }
    this.hudTexts.get('positions')!.setText(visibleLines.join('\n'))
  }

  private fmt(value: number): string {
    return Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  private formatSignedDollars(value: number): string {
    const sign = value >= 0 ? '+' : '-'
    return `${sign}$${this.fmt(value)}`
  }
}
