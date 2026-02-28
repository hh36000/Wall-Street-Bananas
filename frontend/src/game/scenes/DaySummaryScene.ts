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
    let y = 120

    if (gameState.todayTrades.length === 0) {
      this.add.text(cx, y, 'No trades today', { fontSize: '14px', fontFamily: 'monospace', color: '#475569' }).setOrigin(0.5)
      y += 26
    } else {
      this.add.text(cx, y, `TRADES (${gameState.todayTrades.length})`, { fontSize: '14px', fontFamily: 'monospace', color: '#64748b' }).setOrigin(0.5)
      y += 28

      for (const trade of gameState.todayTrades) {
        const color = trade.side === 'BUY' ? '#4ade80' : '#f87171'
        const line = `${trade.side}  ${trade.ticker}  $${trade.notional.toLocaleString()}  ${trade.quantity.toFixed(1)} @ $${trade.price.toFixed(2)}  ${trade.npcName}`
        this.add.text(cx, y, line, { fontSize: '13px', fontFamily: 'monospace', color }).setOrigin(0.5)
        y += 22
      }
    }

    // ─── Next Day Button ───
    const btnY = Math.max(y + 40, height - 80)
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
