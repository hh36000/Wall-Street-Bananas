import Phaser from 'phaser'
import { gameState } from '../GameState'
import { marketData } from '../systems/MarketDataEngine'
import { tradingSystem } from '../systems/TradingSystem'
import { npcManager } from '../systems/NPCManager'
import { TRADERS, TRADING_NPCS } from '../data/traders'
import type { TraderDef, NPCQuote } from '../types'

// NPC positions scattered across the 1408x768 trading floor
const NPC_POSITIONS: Record<string, { x: number; y: number }> = {
  vinny: { x: 200, y: 200 },
  margaret: { x: 450, y: 150 },
  bigal: { x: 700, y: 180 },
  professor: { x: 950, y: 160 },
  donna: { x: 1200, y: 200 },
  quietmike: { x: 150, y: 350 },
  tommy: { x: 380, y: 320 },
  santos: { x: 600, y: 380 },
  ricky: { x: 850, y: 340 },
  eddie: { x: 1100, y: 370 },
  sal: { x: 1300, y: 330 },
  paulie: { x: 250, y: 500 },
  tony: { x: 500, y: 520 },
  nancy: { x: 750, y: 480 },
  bernie: { x: 1000, y: 510 },
  charlie: { x: 1250, y: 490 },
  diane: { x: 180, y: 630 },
  bobby: { x: 420, y: 660 },
  tina: { x: 650, y: 620 },
  jerome: { x: 900, y: 650 },
  gus: { x: 1150, y: 630 },
  maddog: { x: 1350, y: 600 },
  whitey: { x: 350, y: 450 },
  mama: { x: 1050, y: 250 },
  frank: { x: 730, y: 280 },
}

const PLAYER_SPEED = 200
const CAMERA_ZOOM = 1
const INTERACT_DISTANCE = 50
const TRADE_QUANTITY_OPTIONS = [10, 25, 50, 100]

export class TradingFloorScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>
  private interactKey!: Phaser.Input.Keyboard.Key

  // NPC sprites and data
  private npcSprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private npcTraders: Map<string, TraderDef> = new Map()

  // Interaction
  private nearestNPC: string | null = null
  private promptText!: Phaser.GameObjects.Text

  // Trade dialog state
  private dialogOpen = false
  private dialogContainer!: Phaser.GameObjects.Container
  private activeTrader: TraderDef | null = null
  private activeQuote: NPCQuote | null = null
  private tradeQuantity = 50
  private dialogTexts: Map<string, Phaser.GameObjects.Text> = new Map()

  // HUD elements
  private hudContainer!: Phaser.GameObjects.Container
  private hudTexts: Map<string, Phaser.GameObjects.Text> = new Map()

  // Day timer
  private dayTimer!: Phaser.Time.TimerEvent
  private timerPaused = false

  // Debug overlay
  private debugText!: Phaser.GameObjects.Text

  // Escape key to close dialog
  private escKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super('TradingFloorScene')
  }

  create(): void {
    // Reset phase
    gameState.phase = 'trading'
    tradingSystem.startNewDay()

    // --- World setup ---
    const floorImg = this.textures.get('trading-floor')
    const worldW = floorImg.getSourceImage().width
    const worldH = floorImg.getSourceImage().height

    this.add.image(worldW / 2, worldH / 2, 'trading-floor')
    this.physics.world.setBounds(0, 0, worldW, worldH)

    // --- Camera ---
    this.cameras.main.setZoom(CAMERA_ZOOM)
    this.cameras.main.setBounds(0, 0, worldW, worldH)

    // --- Player ---
    // Use a simple colored rectangle — the player.png is too large to scale down cleanly
    this.player = this.add.rectangle(worldW / 2, worldH / 2, 14, 18, 0x6366f1)
    ;(this.player as Phaser.GameObjects.Rectangle).setStrokeStyle(1, 0xa5b4fc)
    this.player.setDepth(50)
    this.physics.add.existing(this.player)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setCollideWorldBounds(true)
    playerBody.setSize(14, 18)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // --- Input ---
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

    // --- Place NPCs ---
    this.placeNPCs()

    // --- Interaction prompt ---
    this.promptText = this.add
      .text(0, 0, 'Press E to trade', {
        fontSize: '8px',
        fontFamily: 'monospace',
        color: '#facc15',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(100)

    // --- Build trade dialog (hidden) ---
    this.buildTradeDialog()

    // --- Build HUD ---
    this.buildHUD()

    // --- Day timer ---
    this.dayTimer = this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true,
    })

    // --- E key handler ---
    this.interactKey.on('down', () => {
      if (this.dialogOpen) return
      if (this.nearestNPC) {
        this.openTradeDialog(this.nearestNPC)
      }
    })

    // --- ESC to close dialog ---
    this.escKey.on('down', () => {
      if (this.dialogOpen) {
        this.closeTradeDialog()
      }
    })

    // --- Debug overlay (bottom-right, always visible) ---
    const cw = this.cameras.main.width
    const ch = this.cameras.main.height
    this.debugText = this.add
      .text(cw - 8, ch - 8, '', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#666666',
        align: 'right',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(9999)
  }

  private placeNPCs(): void {
    const spriteMap: Record<string, string> = {
      vinny: 'vinny-tp',
      margaret: 'margaret-tp',
      mama: 'mama-tp',
    }

    for (const trader of TRADERS) {
      const pos = NPC_POSITIONS[trader.id]
      if (!pos) continue

      const container = this.add.container(pos.x, pos.y)
      container.setDepth(10)

      // Sprite or placeholder
      const textureKey = spriteMap[trader.id] ?? trader.id
      if (this.textures.exists(textureKey)) {
        const sprite = this.add.sprite(0, 0, textureKey)
        // Scale real sprites down, keep placeholders at 1x
        if (spriteMap[trader.id]) {
          sprite.setScale(0.04)
        }
        container.add(sprite)
      } else {
        // Fallback colored circle
        const gfx = this.add.graphics()
        gfx.fillStyle(trader.color, 1)
        gfx.fillCircle(0, 0, 12)
        gfx.lineStyle(1, 0xffffff, 0.4)
        gfx.strokeCircle(0, 0, 12)
        container.add(gfx)

        // Initial letter
        const initial = this.add
          .text(0, 0, trader.nickname[0], {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#ffffff',
          })
          .setOrigin(0.5)
        container.add(initial)
      }

      // Nickname label above
      const nameLabel = this.add
        .text(0, -22, trader.nickname, {
          fontSize: '6px',
          fontFamily: 'monospace',
          color: '#e2e8f0',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5)
      container.add(nameLabel)

      // Ticker label below
      if (trader.ticker) {
        const tickerLabel = this.add
          .text(0, 18, trader.ticker, {
            fontSize: '6px',
            fontFamily: 'monospace',
            color: '#facc15',
            backgroundColor: '#00000088',
            padding: { x: 2, y: 1 },
          })
          .setOrigin(0.5)
        container.add(tickerLabel)
      }

      // Add physics body for overlap detection
      this.physics.add.existing(container)
      const body = container.body as Phaser.Physics.Arcade.Body
      body.setSize(INTERACT_DISTANCE, INTERACT_DISTANCE)
      body.setOffset(-INTERACT_DISTANCE / 2, -INTERACT_DISTANCE / 2)
      body.setImmovable(true)

      this.npcSprites.set(trader.id, container)
      this.npcTraders.set(trader.id, trader)
    }
  }

  // --- Trade Dialog ---

  private buildTradeDialog(): void {
    const cw = this.cameras.main.width
    const ch = this.cameras.main.height
    const dw = 500
    const dh = 400

    // Center of canvas
    this.dialogContainer = this.add.container(cw / 2, ch / 2)
    this.dialogContainer.setScrollFactor(0)
    this.dialogContainer.setDepth(1000)
    this.dialogContainer.setVisible(false)

    // Semi-transparent backdrop covering entire canvas
    const backdrop = this.add.rectangle(0, 0, cw, ch, 0x000000, 0.6)
    this.dialogContainer.add(backdrop)

    // Dialog panel
    const panel = this.add.rectangle(0, 0, dw, dh, 0x1a1a2e, 0.95)
    panel.setStrokeStyle(2, 0x334155)
    this.dialogContainer.add(panel)

    // NPC name
    const nameText = this.add
      .text(0, -dh / 2 + 25, '', {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(nameText)
    this.dialogTexts.set('name', nameText)

    // Stock and quote
    const quoteText = this.add
      .text(0, -dh / 2 + 55, '', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(quoteText)
    this.dialogTexts.set('quote', quoteText)

    // Greeting / chat area
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

    // Quantity selector
    const qtyLabel = this.add
      .text(-dw / 2 + 30, dh / 2 - 155, 'Shares:', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
    this.dialogContainer.add(qtyLabel)

    // Quantity buttons
    let qx = -dw / 2 + 140
    for (const qty of TRADE_QUANTITY_OPTIONS) {
      const qBtn = this.add.rectangle(qx, dh / 2 - 150, 50, 24, 0x334155)
      qBtn.setInteractive({ useHandCursor: true })
      const qBtnText = this.add
        .text(qx, dh / 2 - 150, `${qty}`, {
          fontSize: '13px',
          fontFamily: 'monospace',
          color: '#e2e8f0',
        })
        .setOrigin(0.5)
      qBtn.on('pointerdown', () => {
        this.tradeQuantity = qty
        this.updateDialogQuantity()
      })
      qBtn.on('pointerover', () => qBtn.setFillStyle(0x475569))
      qBtn.on('pointerout', () => qBtn.setFillStyle(0x334155))
      this.dialogContainer.add(qBtn)
      this.dialogContainer.add(qBtnText)
      qx += 60
    }

    // Cost/proceeds info
    const costText = this.add
      .text(0, dh / 2 - 118, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(costText)
    this.dialogTexts.set('cost', costText)

    // --- Action buttons ---
    const btnY = dh / 2 - 70
    const btnW = 145
    const btnH = 40

    // Hit Bid (sell)
    this.createDialogButton(-btnW - 8, btnY, btnW, btnH, 'HIT BID (Sell)', 0xdc2626, () =>
      this.executeTrade('SELL')
    )

    // Lift Offer (buy)
    this.createDialogButton(0, btnY, btnW, btnH, 'LIFT OFFER (Buy)', 0x16a34a, () =>
      this.executeTrade('BUY')
    )

    // Walk Away
    this.createDialogButton(btnW + 8, btnY, btnW, btnH, 'WALK AWAY', 0x475569, () =>
      this.closeTradeDialog()
    )

    // Trade result message
    const resultText = this.add
      .text(0, dh / 2 - 22, '', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#4ade80',
      })
      .setOrigin(0.5)
    this.dialogContainer.add(resultText)
    this.dialogTexts.set('result', resultText)
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

  private openTradeDialog(npcId: string): void {
    const trader = this.npcTraders.get(npcId)
    if (!trader || !trader.ticker) return

    this.activeTrader = trader
    this.activeQuote = npcManager.generateQuote(trader)
    if (!this.activeQuote) return

    this.dialogOpen = true
    this.timerPaused = true

    // Update dialog text
    this.dialogTexts.get('name')!.setText(`${trader.nickname} — ${trader.name}`)
    this.dialogTexts.get('quote')!.setText(npcManager.formatQuote(trader, this.activeQuote))
    this.dialogTexts.get('greeting')!.setText(`"${trader.greeting}"`)
    this.dialogTexts.get('result')!.setText('')

    this.tradeQuantity = tradingSystem.getDefaultQuantity(this.activeQuote.ask)
    this.updateDialogQuantity()

    this.dialogContainer.setVisible(true)
  }

  private updateDialogQuantity(): void {
    if (!this.activeQuote || !this.activeTrader) return
    const buyCost = (this.tradeQuantity * this.activeQuote.ask).toFixed(2)
    const sellProceeds = (this.tradeQuantity * this.activeQuote.bid).toFixed(2)
    this.dialogTexts
      .get('cost')!
      .setText(`${this.tradeQuantity} shares — Buy: $${buyCost}  |  Sell: $${sellProceeds}`)
  }

  private executeTrade(side: 'BUY' | 'SELL'): void {
    if (!this.activeTrader || !this.activeQuote) return

    const price = side === 'BUY' ? this.activeQuote.ask : this.activeQuote.bid
    const ticker = this.activeTrader.ticker!

    let success: boolean
    if (side === 'BUY') {
      success = tradingSystem.buy(
        ticker,
        this.tradeQuantity,
        price,
        this.activeTrader.id,
        this.activeTrader.nickname
      )
    } else {
      success = tradingSystem.sell(
        ticker,
        this.tradeQuantity,
        price,
        this.activeTrader.id,
        this.activeTrader.nickname
      )
    }

    const resultText = this.dialogTexts.get('result')!
    if (success) {
      const verb = side === 'BUY' ? 'Bought' : 'Sold'
      resultText.setColor('#4ade80')
      resultText.setText(
        `${verb} ${this.tradeQuantity} ${ticker} @ $${price.toFixed(2)}`
      )
      this.updateHUD()
    } else {
      resultText.setColor('#f87171')
      resultText.setText('Trade rejected — exceeds margin or debt limit')
    }
  }

  private closeTradeDialog(): void {
    this.dialogOpen = false
    this.timerPaused = false
    this.dialogContainer.setVisible(false)
    this.activeTrader = null
    this.activeQuote = null
  }

  // --- HUD ---

  private buildHUD(): void {
    const cw = this.cameras.main.width

    this.hudContainer = this.add.container(0, 0)
    this.hudContainer.setScrollFactor(0)
    this.hudContainer.setDepth(500)

    // Background bar at top
    const hudBg = this.add.rectangle(cw / 2, 0, cw, 50, 0x0a0a1a, 0.85)
    hudBg.setOrigin(0.5, 0)
    this.hudContainer.add(hudBg)

    // Capital
    const capitalText = this.add.text(16, 6, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#4ade80',
    })
    this.hudContainer.add(capitalText)
    this.hudTexts.set('capital', capitalText)

    // Today's P&L
    const pnlText = this.add.text(16, 28, '', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#94a3b8',
    })
    this.hudContainer.add(pnlText)
    this.hudTexts.set('pnl', pnlText)

    // Day number (center)
    const dayText = this.add
      .text(cw / 2, 6, '', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5, 0)
    this.hudContainer.add(dayText)
    this.hudTexts.set('day', dayText)

    // Timer (center below day)
    const timerText = this.add
      .text(cw / 2, 28, '', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5, 0)
    this.hudContainer.add(timerText)
    this.hudTexts.set('timer', timerText)

    // Positions (right side)
    const posText = this.add
      .text(cw - 16, 6, '', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#94a3b8',
        align: 'right',
      })
      .setOrigin(1, 0)
    this.hudContainer.add(posText)
    this.hudTexts.set('positions', posText)

    this.updateHUD()
  }

  private updateHUD(): void {
    // Capital
    const capitalText = this.hudTexts.get('capital')!
    capitalText.setText(`$${gameState.capital.toFixed(2)}`)
    capitalText.setColor(gameState.capital >= 0 ? '#4ade80' : '#f87171')

    // Today's P&L
    const todayPnl = tradingSystem.getTodayRealizedPnl() + tradingSystem.getUnrealizedPnl()
    const pnlText = this.hudTexts.get('pnl')!
    const pnlSign = todayPnl >= 0 ? '+' : ''
    pnlText.setText(`P&L: ${pnlSign}$${todayPnl.toFixed(2)}`)
    pnlText.setColor(todayPnl >= 0 ? '#4ade80' : '#f87171')

    // Day
    this.hudTexts.get('day')!.setText(`Day ${gameState.dayNumber}`)

    // Timer
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

    // Positions (compact list)
    const posLines: string[] = []
    for (const pos of gameState.positions.values()) {
      const sign = pos.quantity > 0 ? '+' : ''
      posLines.push(`${pos.ticker}:${sign}${pos.quantity}@$${pos.avgPrice.toFixed(2)}`)
    }
    this.hudTexts.get('positions')!.setText(posLines.slice(0, 4).join('\n'))
  }

  // --- Timer ---

  private tickTimer(): void {
    if (this.timerPaused) return

    gameState.tradingTimeRemaining--
    this.updateHUD()

    if (gameState.tradingTimeRemaining <= 0) {
      this.endTradingDay()
    }
  }

  private endTradingDay(): void {
    this.dayTimer.destroy()
    if (this.dialogOpen) {
      this.closeTradeDialog()
    }
    this.scene.start('DaySummaryScene')
  }

  // --- Update loop ---

  update(): void {
    // Always update debug overlay
    this.updateDebug()

    if (this.dialogOpen) return

    const body = this.player.body as Phaser.Physics.Arcade.Body
    let vx = 0
    let vy = 0

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -PLAYER_SPEED
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = PLAYER_SPEED

    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -PLAYER_SPEED
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = PLAYER_SPEED

    body.setVelocity(vx, vy)

    // Check NPC proximity
    this.checkNPCProximity()
  }

  private updateDebug(): void {
    const px = Math.round(this.player.x)
    const py = Math.round(this.player.y)
    const fps = Math.round(this.game.loop.actualFps)
    const near = this.nearestNPC ?? 'none'
    const dlg = this.dialogOpen ? 'OPEN' : 'closed'
    const timer = gameState.tradingTimeRemaining
    const positions = gameState.positions.size
    const trades = gameState.todayTrades.length
    const cam = this.cameras.main
    const vw = cam.width / cam.zoom
    const vh = cam.height / cam.zoom

    this.debugText.setText(
      [
        `FPS:${fps} Canvas:${cam.width}x${cam.height} Zoom:${cam.zoom}`,
        `Viewport:${Math.round(vw)}x${Math.round(vh)}`,
        `Player:${px},${py} Near:${near}`,
        `Dialog:${dlg} Timer:${timer}s`,
        `Pos:${positions} Trades:${trades} Cap:$${gameState.capital.toFixed(0)}`,
      ].join('\n')
    )
  }

  private checkNPCProximity(): void {
    let closest: string | null = null
    let closestDist = INTERACT_DISTANCE

    const px = this.player.x
    const py = this.player.y

    for (const [id, container] of this.npcSprites) {
      const trader = this.npcTraders.get(id)
      if (!trader?.ticker) continue // skip non-trading NPCs

      const dist = Phaser.Math.Distance.Between(px, py, container.x, container.y)
      if (dist < closestDist) {
        closestDist = dist
        closest = id
      }
    }

    if (closest !== this.nearestNPC) {
      this.nearestNPC = closest
      if (closest) {
        const container = this.npcSprites.get(closest)!
        this.promptText.setPosition(container.x, container.y + 28)
        this.promptText.setVisible(true)
      } else {
        this.promptText.setVisible(false)
      }
    }
  }
}
