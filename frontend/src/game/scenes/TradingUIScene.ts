import Phaser from 'phaser'
import { gameState } from '../GameState'
import { tradingSystem } from '../systems/TradingSystem'
import { npcManager } from '../systems/NPCManager'
import { marketData } from '../systems/MarketDataEngine'
import type { TraderDef, NPCQuote } from '../types'

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

  private escKey!: Phaser.Input.Keyboard.Key
  private buyKey!: Phaser.Input.Keyboard.Key
  private sellKey!: Phaser.Input.Keyboard.Key
  private flattenKey!: Phaser.Input.Keyboard.Key
  private cheatKeyHandler!: (e: KeyboardEvent) => void

  constructor() {
    super('TradingUIScene')
  }

  create(): void {
    this.buildTradeDialog()
    this.buildHUD()

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.buyKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B)
    this.sellKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.flattenKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)

    this.escKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen) return
      // Close cheat overlay first, then dialog
      if (this.cheatVisible) {
        this.cheatVisible = false
        this.cheatContainer.setVisible(false)
        return
      }
      this.closeTradeDialog()
    })

    this.buyKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen) return
      this.executeTrade('BUY')
    })

    this.sellKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen) return
      this.executeTrade('SELL')
    })

    this.flattenKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen) return
      this.executeFlatten()
    })

    // Cmd+/ (or Ctrl+/) to toggle cheat overlay
    this.cheatKeyHandler = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey) && this.dialogOpen) {
        e.preventDefault()
        this.toggleCheat()
      }
    }
    window.addEventListener('keydown', this.cheatKeyHandler)

    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.cheatKeyHandler)
    })
  }

  public isDialogOpen(): boolean {
    return this.dialogOpen
  }

  public openTradeDialog(trader: TraderDef): void {
    if (!trader.ticker) return

    this.activeTrader = trader
    this.activeQuote = npcManager.generateQuote(trader)
    if (!this.activeQuote) return

    this.dialogOpen = true

    this.dialogTexts.get('name')!.setText(`${trader.nickname} — ${trader.name}`)
    this.dialogTexts.get('quote')!.setText(npcManager.formatQuote(trader, this.activeQuote))
    this.dialogTexts.get('greeting')!.setText(`"${trader.greeting}"`)
    this.dialogTexts.get('result')!.setText('')

    // Reset cheat overlay
    this.cheatVisible = false
    this.cheatContainer.setVisible(false)
    this.updateCheatInfo()

    this.updateTradeInfo()

    this.dialogContainer.setVisible(true)
  }

  public closeTradeDialog(): void {
    this.dialogOpen = false
    this.dialogContainer.setVisible(false)
    this.activeTrader = null
    this.activeQuote = null
  }

  public refreshHUD(): void {
    if (this.hudTexts.size === 0) return
    this.updateHUD()
  }

  private buildTradeDialog(): void {
    const cw = this.scale.width
    const ch = this.scale.height
    const dw = 500
    const dh = 400

    this.dialogContainer = this.add.container(cw / 2, ch / 2)
    this.dialogContainer.setDepth(1000)
    this.dialogContainer.setVisible(false)

    const backdrop = this.add.rectangle(0, 0, cw, ch, 0x000000, 0.6)
    this.dialogContainer.add(backdrop)

    const panel = this.add.rectangle(0, 0, dw, dh, 0x1a1a2e, 0.95)
    panel.setStrokeStyle(2, 0x334155)
    this.dialogContainer.add(panel)

    const nameText = this.add
      .text(0, -dh / 2 + 25, '', {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(nameText)
    this.dialogTexts.set('name', nameText)

    const quoteText = this.add
      .text(0, -dh / 2 + 55, '', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(quoteText)
    this.dialogTexts.set('quote', quoteText)

    const greetingText = this.add
      .text(0, -dh / 2 + 95, '', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#94a3b8',
        wordWrap: { width: dw - 40 },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0)
    this.dialogContainer.add(greetingText)
    this.dialogTexts.set('greeting', greetingText)

    const notionalLabel = this.add
      .text(0, dh / 2 - 150, '', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(notionalLabel)
    this.dialogTexts.set('notional', notionalLabel)

    const costText = this.add
      .text(0, dh / 2 - 118, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(costText)
    this.dialogTexts.set('cost', costText)

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

    // Flatten button — only visible when holding a position
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

    const resultText = this.add
      .text(0, dh / 2 - 10, '', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#4ade80',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(resultText)
    this.dialogTexts.set('result', resultText)

    // Cheat button — small "?" in bottom-right corner of panel
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

    // Cheat info overlay
    this.cheatContainer = this.add.container(0, 0)
    this.cheatContainer.setVisible(false)

    const cheatBg = this.add.rectangle(0, 0, dw - 40, 120, 0x1e1b4b, 0.95)
    cheatBg.setStrokeStyle(1, 0x7c3aed)
    this.cheatContainer.add(cheatBg)

    const cheatTitle = this.add
      .text(0, -42, 'CHEAT SHEET', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#a78bfa',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.cheatContainer.add(cheatTitle)

    const cheatInfo = this.add
      .text(0, 0, '', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#e9d5ff',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5)
    this.cheatContainer.add(cheatInfo)
    this.dialogTexts.set('cheatInfo', cheatInfo)

    this.dialogContainer.add(this.cheatContainer)
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
      this.updateTradeInfo()
      this.updateHUD()
    } else {
      resultText.setColor('#f87171')
      resultText.setText('Trade rejected — projected exposure or debt limit exceeded')
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
      this.updateTradeInfo()
      this.updateHUD()
    }
  }

  private toggleCheat(): void {
    this.cheatVisible = !this.cheatVisible
    this.cheatContainer.setVisible(this.cheatVisible)
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
        fontSize: '15px',
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

    const limitText = this.add
      .text(cw / 2, 43, '', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#64748b',
      })
      .setOrigin(0.5, 0)
    this.hudContainer.add(limitText)
    this.hudTexts.set('limit', limitText)

    const posText = this.add
      .text(cw - 16, 6, '', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#94a3b8',
        align: 'right',
      })
      .setOrigin(1, 0)
    this.hudContainer.add(posText)
    this.hudTexts.set('positions', posText)

    const endDayBtn = this.add.rectangle(cw / 2 + 185, 53, 120, 24, 0x7f1d1d)
    endDayBtn.setInteractive({ useHandCursor: true })
    endDayBtn.on('pointerover', () => endDayBtn.setFillStyle(0x991b1b))
    endDayBtn.on('pointerout', () => endDayBtn.setFillStyle(0x7f1d1d))
    endDayBtn.on('pointerdown', () => {
      this.game.events.emit('trading:end-day-early')
    })
    this.hudContainer.add(endDayBtn)

    const endDayLabel = this.add
      .text(cw / 2 + 185, 53, 'END DAY', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    this.hudContainer.add(endDayLabel)

    this.updateHUD()
  }

  private updateHUD(): void {
    const capitalText = this.hudTexts.get('capital')!
    capitalText.setText(`Cash: $${this.fmt(gameState.capital)}`)
    capitalText.setColor(gameState.capital >= 0 ? '#4ade80' : '#f87171')

    const todayPnl = tradingSystem.getTodayRealizedPnl() + tradingSystem.getUnrealizedPnl()
    const pnlText = this.hudTexts.get('pnl')!
    const pnlSign = todayPnl >= 0 ? '+' : ''
    pnlText.setText(`P&L: ${pnlSign}$${this.fmt(todayPnl)}`)
    pnlText.setColor(todayPnl >= 0 ? '#4ade80' : '#f87171')

    const netExposure = tradingSystem.getNetMarketExposure()
    const grossExposure = tradingSystem.getGrossMarketExposure()
    this.hudTexts
      .get('exposure')!
      .setText(`Net Exp: ${this.formatSignedDollars(netExposure)}  Gross: $${this.fmt(grossExposure)}`)
    this.hudTexts.get('limit')!.setText(`Limit: ±$${this.fmt(gameState.maxPositionValue)}`)

    this.hudTexts.get('day')!.setText(`Day ${gameState.dayNumber}`)

    const mins = Math.floor(gameState.tradingTimeRemaining / 60)
    const secs = gameState.tradingTimeRemaining % 60
    const timerText = this.hudTexts.get('timer')!
    timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`)
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
