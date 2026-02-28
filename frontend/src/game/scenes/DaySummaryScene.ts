import Phaser from 'phaser'
import { gameState } from '../GameState'
import { marketData } from '../systems/MarketDataEngine'
import { tradingSystem } from '../systems/TradingSystem'
import { playLoopedMusic } from '../systems/MusicManager'
import { SaveManager } from '../systems/SaveManager'

export class DaySummaryScene extends Phaser.Scene {
  private music!: Phaser.Sound.WebAudioSound

  constructor() {
    super('DaySummaryScene')
  }

  create(): void {
    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }

    // Play summary music (looped from 0:27 with crossfade)
    this.music = playLoopedMusic(this, 'music-summary')

    gameState.phase = 'summary'

    const { width, height } = this.scale
    const cx = width / 2

    tradingSystem.endOfDay()

    // Video background
    const vid = this.add.video(cx, height / 2, 'gridpink')
    vid.play(true)
    vid.setDisplaySize(width, height)

    // Semi-transparent overlay for readability
    this.add.rectangle(cx, height / 2, width, height, 0x0a0a1a, 0.65)

    // ─── Date / Day ───
    this.add
      .text(cx, 50, marketData.formatDate(gameState.currentDate), {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)

    this.add
      .text(cx, 80, `Day ${gameState.dayNumber}`, {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    // ─── Trades ───
    const tradesHeaderY = 120
    const btnY = height - 80
    const scrollAreaTop = tradesHeaderY
    const scrollAreaHeight = btnY - tradesHeaderY - 30

    if (gameState.todayTrades.length === 0) {
      this.add.text(cx, tradesHeaderY, 'No trades today', { fontSize: '14px', fontFamily: 'monospace', color: '#475569' }).setOrigin(0.5)
    } else {
      this.add.text(cx, tradesHeaderY, `TRADES (${gameState.todayTrades.length})`, { fontSize: '14px', fontFamily: 'monospace', color: '#64748b' }).setOrigin(0.5)

      const container = this.add.container(0, 0)
      let ty = tradesHeaderY + 28

      for (const trade of gameState.todayTrades) {
        const color = trade.side === 'BUY' ? '#4ade80' : '#f87171'
        const line = `${trade.side}  ${trade.ticker}  $${trade.notional.toLocaleString()}  ${trade.quantity.toFixed(1)} @ $${trade.price.toFixed(2)}  ${trade.npcName}`
        const txt = this.add.text(cx, ty, line, { fontSize: '13px', fontFamily: 'monospace', color }).setOrigin(0.5)
        container.add(txt)
        ty += 22
      }

      // Mask so trades don't overflow into header or button
      const maskTop = tradesHeaderY + 20
      const maskShape = this.make.graphics()
      maskShape.fillRect(0, maskTop, width, scrollAreaHeight)
      const mask = maskShape.createGeometryMask()
      container.setMask(mask)

      // Scroll with mouse wheel
      const contentHeight = gameState.todayTrades.length * 22
      const visibleHeight = scrollAreaHeight
      if (contentHeight > visibleHeight) {
        const maxScroll = contentHeight - visibleHeight
        let scrollOffset = 0
        this.input.on('wheel', (_p: unknown, _gx: unknown, _gy: unknown, _gz: unknown, dy: number) => {
          scrollOffset = Phaser.Math.Clamp(scrollOffset + dy * 0.5, 0, maxScroll)
          container.y = -scrollOffset
        })
      }
    }

    // ─── Next Day Button ───
    const btn = this.add.rectangle(cx, btnY, 220, 45, 0x2563eb)
    btn.setInteractive({ useHandCursor: true })

    this.add.text(cx, btnY, 'NEXT DAY (N)', { fontSize: '18px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5)

    btn.on('pointerover', () => btn.setFillStyle(0x3b82f6))
    btn.on('pointerout', () => btn.setFillStyle(0x2563eb))
    btn.on('pointerdown', () => this.advanceToNextDay())

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N).on('down', () => this.advanceToNextDay())
  }

  private advanceToNextDay(): void {
    this.music.stop()
    gameState.dayNumber++
    const nextDate = marketData.advanceDay()
    if (!nextDate) {
      gameState.isGameOver = true
      this.scene.restart()
      return
    }
    gameState.currentDate = nextDate
    gameState.phase = 'morning'
    SaveManager.save()
    this.scene.start('MorningScene')
  }
}
