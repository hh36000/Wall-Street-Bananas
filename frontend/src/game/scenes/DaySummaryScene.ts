import Phaser from 'phaser'
import { gameState } from '../GameState'
import { marketData } from '../systems/MarketDataEngine'
import { tradingSystem } from '../systems/TradingSystem'

export class DaySummaryScene extends Phaser.Scene {
  constructor() {
    super('DaySummaryScene')
  }

  create(): void {
    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }

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
      .text(cx, 30, `${marketData.formatDate(gameState.currentDate)}  —  Day ${gameState.dayNumber}`, {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    // ─── P&L ───
    const netColor = result.netPnl >= 0 ? '#4ade80' : '#f87171'
    const netSign = result.netPnl >= 0 ? '+' : '-'

    this.add.text(cx, 60, `${netSign}$${fmt(result.netPnl)}`, { fontSize: '36px', fontFamily: 'monospace', color: netColor }).setOrigin(0.5)

    const grade = this.getPerformanceGrade(result.netPnl, gameState.todayTrades.length)
    this.add.text(cx, 96, grade.label, { fontSize: '11px', fontFamily: 'monospace', color: grade.color }).setOrigin(0.5)

    // Realized / Unrealized line
    const realSign = result.realizedPnl >= 0 ? '+' : '-'
    const unrealSign = result.unrealizedPnl >= 0 ? '+' : '-'
    this.add.text(cx, 118, `realized ${realSign}$${fmt(result.realizedPnl)}  ·  unrealized ${unrealSign}$${fmt(result.unrealizedPnl)}`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#475569',
    }).setOrigin(0.5)

    // Capital line
    const capColor = gameState.capital >= 0 ? '#4ade80' : '#f87171'
    this.add.text(cx, 138, `Capital: $${fmt(gameState.capital)}`, { fontSize: '12px', fontFamily: 'monospace', color: capColor }).setOrigin(0.5)

    // ─── Thin separator ───
    this.add.rectangle(cx, 158, 500, 1, 0x1e293b)

    // ─── Trades ───
    let y = 172

    if (gameState.todayTrades.length === 0) {
      this.add.text(cx, y, 'No trades today', { fontSize: '10px', fontFamily: 'monospace', color: '#334155' }).setOrigin(0.5)
      y += 20
    } else {
      this.add.text(cx, y, `TRADES (${gameState.todayTrades.length})`, { fontSize: '9px', fontFamily: 'monospace', color: '#64748b' }).setOrigin(0.5)
      y += 16

      const maxVisible = 6
      const trades = gameState.todayTrades.slice(0, maxVisible)
      for (const trade of trades) {
        const color = trade.side === 'BUY' ? '#4ade80' : '#f87171'
        const line = `${trade.side}  ${trade.ticker}  $${trade.notional.toLocaleString()}  ${trade.quantity.toFixed(1)} @ $${trade.price.toFixed(2)}  ${trade.npcName}`
        this.add.text(cx, y, line, { fontSize: '9px', fontFamily: 'monospace', color }).setOrigin(0.5)
        y += 14
      }
      if (gameState.todayTrades.length > maxVisible) {
        this.add.text(cx, y, `+${gameState.todayTrades.length - maxVisible} more`, { fontSize: '8px', fontFamily: 'monospace', color: '#334155' }).setOrigin(0.5)
        y += 14
      }
    }

    // ─── Open Positions ───
    if (gameState.positions.size > 0) {
      this.add.rectangle(cx, y + 6, 500, 1, 0x1e293b)
      y += 18

      this.add.text(cx, y, `POSITIONS (${gameState.positions.size})`, { fontSize: '9px', fontFamily: 'monospace', color: '#64748b' }).setOrigin(0.5)
      y += 16

      for (const pos of gameState.positions.values()) {
        const currentPrice = marketData.getPrice(pos.ticker) ?? pos.avgPrice
        const posPnl = (currentPrice - pos.avgPrice) * pos.quantity
        const posColor = posPnl >= 0 ? '#4ade80' : '#f87171'
        const side = pos.quantity >= 0 ? 'L' : 'S'
        const pnlSign = posPnl >= 0 ? '+' : '-'

        const line = `${pos.ticker} ${side} ${Math.abs(pos.quantity).toFixed(1)} @ $${pos.avgPrice.toFixed(2)}  →  $${currentPrice.toFixed(2)}  ${pnlSign}$${fmt(Math.abs(posPnl))}`
        this.add.text(cx, y, line, { fontSize: '9px', fontFamily: 'monospace', color: posColor }).setOrigin(0.5)
        y += 14
      }
    }

    // ─── Debt Warning ───
    if (gameState.isInDebt) {
      y += 12
      this.add.rectangle(cx, y + 8, 460, 26, 0x7f1d1d, 0.5)
      this.add
        .text(cx, y + 8, `⚠ $${fmt(Math.abs(gameState.capital))} in debt — Day ${gameState.consecutiveDaysInDebt}/3`, {
          fontSize: '10px', fontFamily: 'monospace', color: '#fca5a5',
        })
        .setOrigin(0.5)
      y += 30
    }

    // ─── Game Over ───
    if (gameState.isGameOver) {
      this.showGameOver(y)
      return
    }

    // ─── Next Day Button ───
    const btnY = Math.max(y + 30, height - 50)
    const btn = this.add.rectangle(cx, btnY, 180, 36, 0x2563eb)
    btn.setInteractive({ useHandCursor: true })

    this.add.text(cx, btnY, 'NEXT DAY (N)', { fontSize: '12px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5)

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

  private showGameOver(startY: number): void {
    const { width } = this.scale
    const cx = width / 2

    this.add.text(cx, startY + 10, 'GAME OVER', { fontSize: '24px', fontFamily: '"Press Start 2P"', color: '#ef4444' }).setOrigin(0.5)
    this.add.text(cx, startY + 45, 'The mob sends its regards.', { fontSize: '11px', fontFamily: 'monospace', color: '#f87171' }).setOrigin(0.5)

    let sy = startY + 70
    const peakCapital = Math.max(gameState.startingCapital, ...gameState.dayResults.map((d) => d.endingCapital))

    const stats = [
      `Days Survived: ${gameState.dayNumber}`,
      `Peak Capital: $${peakCapital.toFixed(2)}`,
      `Total Trades: ${gameState.allTrades.length}`,
      `Final Capital: $${gameState.capital.toFixed(2)}`,
    ]

    for (const stat of stats) {
      this.add.text(cx, sy, stat, { fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }).setOrigin(0.5)
      sy += 18
    }

    const btn = this.add.rectangle(cx, sy + 16, 180, 36, 0xdc2626)
    btn.setInteractive({ useHandCursor: true })
    this.add.text(cx, sy + 16, 'TRY AGAIN', { fontSize: '12px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5)

    btn.on('pointerover', () => btn.setFillStyle(0xef4444))
    btn.on('pointerout', () => btn.setFillStyle(0xdc2626))
    btn.on('pointerdown', () => {
      gameState.reset()
      marketData.setDateIndex(0)
      gameState.currentDate = marketData.currentDate
      this.scene.start('MorningScene')
    })
  }

  private advanceToNextDay(): void {
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
