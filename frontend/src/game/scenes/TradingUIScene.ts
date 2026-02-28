import Phaser from 'phaser'
import { gameState } from '../GameState'
import { tradingSystem } from '../systems/TradingSystem'
import { npcManager } from '../systems/NPCManager'
import type { TraderDef, NPCQuote } from '../types'

const TRADE_QUANTITY_OPTIONS = [10, 25, 50, 100]

export class TradingUIScene extends Phaser.Scene {
  private dialogOpen = false
  private dialogContainer!: Phaser.GameObjects.Container
  private activeTrader: TraderDef | null = null
  private activeQuote: NPCQuote | null = null
  private tradeQuantity = 50
  private dialogTexts: Map<string, Phaser.GameObjects.Text> = new Map()

  private hudContainer!: Phaser.GameObjects.Container
  private hudTexts: Map<string, Phaser.GameObjects.Text> = new Map()

  private escKey!: Phaser.Input.Keyboard.Key
  private buyKey!: Phaser.Input.Keyboard.Key
  private sellKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super('TradingUIScene')
  }

  create(): void {
    this.buildTradeDialog()
    this.buildHUD()

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.buyKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B)
    this.sellKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)

    this.escKey.on('down', (event: KeyboardEvent) => {
      if (event.repeat || !this.dialogOpen) return
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

    this.tradeQuantity = tradingSystem.getDefaultQuantity(this.activeQuote.ask)
    this.updateDialogQuantity()

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

    const qtyLabel = this.add.text(-dw / 2 + 30, dh / 2 - 155, 'Shares:', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#94a3b8',
    })
    this.dialogContainer.add(qtyLabel)

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

  private updateDialogQuantity(): void {
    if (!this.activeQuote || !this.activeTrader) return

    const ticker = this.activeTrader.ticker!
    const buyCost = (this.tradeQuantity * this.activeQuote.ask).toFixed(2)
    const sellProceeds = (this.tradeQuantity * this.activeQuote.bid).toFixed(2)
    const buyExposure = tradingSystem.getProjectedPositionMarketValue(
      ticker,
      this.tradeQuantity,
      this.activeQuote.ask
    )
    const sellExposure = tradingSystem.getProjectedPositionMarketValue(
      ticker,
      -this.tradeQuantity,
      this.activeQuote.bid
    )

    this.dialogTexts
      .get('cost')!
      .setText(
        `${this.tradeQuantity} shares — Buy: $${buyCost}  |  Sell: $${sellProceeds}\nNext exposure — Buy: ${this.formatSignedDollars(buyExposure)}  |  Sell: ${this.formatSignedDollars(sellExposure)}`
      )
  }

  private executeTrade(side: 'BUY' | 'SELL'): void {
    if (!this.activeTrader || !this.activeQuote) return

    const price = side === 'BUY' ? this.activeQuote.ask : this.activeQuote.bid
    const ticker = this.activeTrader.ticker!

    let success = false
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
      resultText.setText(`${verb} ${this.tradeQuantity} ${ticker} @ $${price.toFixed(2)}`)
      this.updateDialogQuantity()
      this.updateHUD()
    } else {
      resultText.setColor('#f87171')
      resultText.setText('Trade rejected — projected exposure or debt limit exceeded')
    }
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
    capitalText.setText(`Cash: $${gameState.capital.toFixed(2)}`)
    capitalText.setColor(gameState.capital >= 0 ? '#4ade80' : '#f87171')

    const todayPnl = tradingSystem.getTodayRealizedPnl() + tradingSystem.getUnrealizedPnl()
    const pnlText = this.hudTexts.get('pnl')!
    const pnlSign = todayPnl >= 0 ? '+' : ''
    pnlText.setText(`P&L: ${pnlSign}$${todayPnl.toFixed(2)}`)
    pnlText.setColor(todayPnl >= 0 ? '#4ade80' : '#f87171')

    const netExposure = tradingSystem.getNetMarketExposure()
    const grossExposure = tradingSystem.getGrossMarketExposure()
    this.hudTexts
      .get('exposure')!
      .setText(`Net Exp: ${this.formatSignedDollars(netExposure)}  Gross: $${grossExposure.toFixed(0)}`)
    this.hudTexts.get('limit')!.setText(`Limit: ±$${gameState.maxPositionValue.toFixed(0)}`)

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
        `${pos.ticker} ${side} ${Math.abs(pos.quantity)} | MV ${this.formatSignedDollars(marketValue)}`
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

  private formatSignedDollars(value: number): string {
    const sign = value >= 0 ? '+' : '-'
    return `${sign}$${Math.abs(value).toFixed(0)}`
  }
}
