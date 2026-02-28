import Phaser from 'phaser'
import { gameState } from '../GameState'
import { marketData } from '../systems/MarketDataEngine'
import { tradingSystem } from '../systems/TradingSystem'

export class DaySummaryScene extends Phaser.Scene {
  private music!: Phaser.Sound.BaseSound

  constructor() {
    super('DaySummaryScene')
  }

  create(): void {
    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }

    // Play summary music (looped)
    this.music = this.sound.add('music-summary', { loop: true, volume: 0.5 })
    this.music.play()

    gameState.phase = 'summary'

    const { width, height } = this.scale
    const cx = width / 2

    const result = tradingSystem.endOfDay()

    const fmt = (v: number, decimals = 2) =>
      Math.abs(v).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })

    // Dark background
    this.add.rectangle(cx, height / 2, width, height, 0x0a0a1a)

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

    // ─── P&L ───
    const netColor = result.netPnl >= 0 ? '#4ade80' : '#f87171'
    const netSign = result.netPnl >= 0 ? '+' : '-'

    this.add.text(cx, 120, `${netSign}$${fmt(result.netPnl)}`, { fontSize: '40px', fontFamily: 'monospace', color: netColor }).setOrigin(0.5)

    const grade = this.getPerformanceGrade(result.netPnl, gameState.todayTrades.length)
    this.add.text(cx, 160, grade.label, { fontSize: '14px', fontFamily: 'monospace', color: grade.color }).setOrigin(0.5)

    // Realized / Unrealized line
    const realSign = result.realizedPnl >= 0 ? '+' : '-'
    const unrealSign = result.unrealizedPnl >= 0 ? '+' : '-'
    this.add.text(cx, 188, `realized ${realSign}$${fmt(result.realizedPnl)}  ·  unrealized ${unrealSign}$${fmt(result.unrealizedPnl)}`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#475569',
    }).setOrigin(0.5)

    // Cumulative P&L line
    const cumPnl = gameState.cumulativePnl + result.netPnl
    const cumColor = cumPnl >= 0 ? '#4ade80' : '#f87171'
    const cumSign = cumPnl >= 0 ? '+' : '-'
    this.add.text(cx, 214, `Cumulative P&L: ${cumSign}$${fmt(cumPnl)}`, { fontSize: '14px', fontFamily: 'monospace', color: cumColor }).setOrigin(0.5)

    // ─── Thin separator ───
    this.add
      .text(cx, 240, '─'.repeat(40), {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#334155',
      })
      .setOrigin(0.5)

    // ─── Trades ───
    let y = 264

    if (gameState.todayTrades.length === 0) {
      this.add.text(cx, y, 'No trades today', { fontSize: '13px', fontFamily: 'monospace', color: '#334155' }).setOrigin(0.5)
      y += 26
    } else {
      this.add.text(cx, y, `TRADES (${gameState.todayTrades.length})`, { fontSize: '13px', fontFamily: 'monospace', color: '#64748b' }).setOrigin(0.5)
      y += 24

      const maxVisible = 6
      const trades = gameState.todayTrades.slice(0, maxVisible)
      for (const trade of trades) {
        const color = trade.side === 'BUY' ? '#4ade80' : '#f87171'
        const line = `${trade.side}  ${trade.ticker}  $${trade.notional.toLocaleString()}  ${trade.quantity.toFixed(1)} @ $${trade.price.toFixed(2)}  ${trade.npcName}`
        this.add.text(cx, y, line, { fontSize: '13px', fontFamily: 'monospace', color }).setOrigin(0.5)
        y += 20
      }
      if (gameState.todayTrades.length > maxVisible) {
        this.add.text(cx, y, `+${gameState.todayTrades.length - maxVisible} more`, { fontSize: '12px', fontFamily: 'monospace', color: '#334155' }).setOrigin(0.5)
        y += 20
      }
    }

    // ─── Open Positions ───
    if (gameState.positions.size > 0) {
      this.add
        .text(cx, y + 6, '─'.repeat(40), {
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#334155',
        })
        .setOrigin(0.5)
      y += 24

      this.add.text(cx, y, `POSITIONS (${gameState.positions.size})`, { fontSize: '13px', fontFamily: 'monospace', color: '#64748b' }).setOrigin(0.5)
      y += 24

      for (const pos of gameState.positions.values()) {
        const currentPrice = marketData.getPrice(pos.ticker) ?? pos.avgPrice
        const posPnl = (currentPrice - pos.avgPrice) * pos.quantity
        const posColor = posPnl >= 0 ? '#4ade80' : '#f87171'
        const side = pos.quantity >= 0 ? 'L' : 'S'
        const pnlSign = posPnl >= 0 ? '+' : '-'

        const line = `${pos.ticker} ${side} ${Math.abs(pos.quantity).toFixed(1)} @ $${pos.avgPrice.toFixed(2)}  →  $${currentPrice.toFixed(2)}  ${pnlSign}$${fmt(Math.abs(posPnl))}`
        this.add.text(cx, y, line, { fontSize: '13px', fontFamily: 'monospace', color: posColor }).setOrigin(0.5)
        y += 20
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

  private getPerformanceGrade(netPnl: number, tradeCount: number): { label: string; color: string } {
    if (tradeCount === 0) return { label: 'IDLE — no trades', color: '#475569' }
    if (netPnl > 5000) return { label: 'LEGENDARY', color: '#facc15' }
    if (netPnl > 1000) return { label: 'KILLING IT', color: '#4ade80' }
    if (netPnl > 100) return { label: 'SOLID DAY', color: '#4ade80' }
    if (netPnl > 0) return { label: 'IN THE GREEN', color: '#86efac' }
    if (netPnl > -100) return { label: 'SCRATCHED', color: '#fbbf24' }
    if (netPnl > -1000) return { label: 'ROUGH DAY', color: '#fb923c' }
    if (netPnl > -5000) return { label: 'BLEEDING', color: '#f87171' }
    return { label: 'CATASTROPHIC', color: '#ef4444' }
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
    this.scene.start('MorningScene')
  }
}
