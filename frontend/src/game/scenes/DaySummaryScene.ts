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

    // End of day settlement
    const result = tradingSystem.endOfDay()

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a)

    // Title
    this.add
      .text(width / 2, 30, 'DAY SUMMARY', {
        fontSize: '24px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5)

    // Date and day
    this.add
      .text(width / 2, 60, `${marketData.formatDate(gameState.currentDate)} — Day ${gameState.dayNumber}`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    // Separator
    this.add
      .text(width / 2, 80, '─'.repeat(50), {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#334155',
      })
      .setOrigin(0.5)

    // Trades list
    let y = 100
    this.add.text(40, y, "TODAY'S TRADES", {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#e2e8f0',
    })
    y += 22

    if (gameState.todayTrades.length === 0) {
      this.add.text(40, y, 'No trades today.', {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#64748b',
      })
      y += 18
    } else {
      // Header
      this.add.text(40, y, 'Side    Stock   Qty    Price      NPC', {
        fontSize: '9px',
        fontFamily: 'monospace',
        color: '#64748b',
      })
      y += 16

      const maxVisible = 8
      const trades = gameState.todayTrades.slice(0, maxVisible)
      for (const trade of trades) {
        const color = trade.side === 'BUY' ? '#4ade80' : '#f87171'
        const line = `${trade.side.padEnd(7)} ${trade.ticker.padEnd(7)} ${String(trade.quantity).padEnd(6)} $${trade.price.toFixed(2).padEnd(10)} ${trade.npcName}`
        this.add.text(40, y, line, {
          fontSize: '9px',
          fontFamily: 'monospace',
          color,
        })
        y += 15
      }

      if (gameState.todayTrades.length > maxVisible) {
        this.add.text(40, y, `... and ${gameState.todayTrades.length - maxVisible} more trades`, {
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#64748b',
        })
        y += 15
      }
    }

    // P&L Section
    y += 15
    this.add
      .text(width / 2, y, '─'.repeat(50), {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#334155',
      })
      .setOrigin(0.5)
    y += 18

    // Realized P&L
    const realColor = result.realizedPnl >= 0 ? '#4ade80' : '#f87171'
    const realSign = result.realizedPnl >= 0 ? '+' : ''
    this.add.text(40, y, `Realized P&L:     ${realSign}$${result.realizedPnl.toFixed(2)}`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: realColor,
    })
    y += 20

    // Unrealized P&L
    const unrealColor = result.unrealizedPnl >= 0 ? '#4ade80' : '#f87171'
    const unrealSign = result.unrealizedPnl >= 0 ? '+' : ''
    this.add.text(40, y, `Unrealized P&L:   ${unrealSign}$${result.unrealizedPnl.toFixed(2)}`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: unrealColor,
    })
    y += 20

    // Net P&L
    const netColor = result.netPnl >= 0 ? '#4ade80' : '#f87171'
    const netSign = result.netPnl >= 0 ? '+' : ''
    this.add.text(40, y, `Net P&L:          ${netSign}$${result.netPnl.toFixed(2)}`, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: netColor,
    })
    y += 25

    // Separator
    this.add
      .text(width / 2, y, '─'.repeat(50), {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#334155',
      })
      .setOrigin(0.5)
    y += 18

    // Total capital
    const capColor = gameState.capital >= 0 ? '#4ade80' : '#f87171'
    this.add.text(40, y, `Total Capital:    $${gameState.capital.toFixed(2)}`, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: capColor,
    })
    y += 25

    // Open positions
    if (gameState.positions.size > 0) {
      this.add.text(40, y, 'Open Positions:', {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      y += 18
      for (const pos of gameState.positions.values()) {
        const currentPrice = marketData.getPrice(pos.ticker) ?? pos.avgPrice
        const marketValue = pos.quantity * currentPrice
        const posPnl = (currentPrice - pos.avgPrice) * pos.quantity
        const posColor = posPnl >= 0 ? '#4ade80' : '#f87171'
        const side = pos.quantity >= 0 ? 'LONG' : 'SHORT'
        const mvSign = marketValue >= 0 ? '+' : '-'
        this.add.text(
          40,
          y,
          `  ${pos.ticker}: ${side} ${Math.abs(pos.quantity)} | MV ${mvSign}$${Math.abs(marketValue).toFixed(0)} (${posPnl >= 0 ? '+' : ''}$${posPnl.toFixed(2)})`,
          {
            fontSize: '9px',
            fontFamily: 'monospace',
            color: posColor,
          }
        )
        y += 15
      }
    }

    // Debt warning
    if (gameState.isInDebt) {
      y += 10
      this.add
        .text(
          width / 2,
          y,
          `WARNING: You are $${Math.abs(gameState.capital).toFixed(2)} in debt. Day ${gameState.consecutiveDaysInDebt} of 3.`,
          {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#f87171',
          }
        )
        .setOrigin(0.5)
      y += 20
    }

    // Game Over check
    if (gameState.isGameOver) {
      this.showGameOver(y)
      return
    }

    // Next Day button
    const btnY = Math.max(y + 30, height - 60)
    const btn = this.add.rectangle(width / 2, btnY, 200, 40, 0x2563eb)
    btn.setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, btnY, 'NEXT DAY', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    btn.on('pointerover', () => btn.setFillStyle(0x3b82f6))
    btn.on('pointerout', () => btn.setFillStyle(0x2563eb))
    btn.on('pointerdown', () => {
      this.advanceToNextDay()
    })
  }

  private showGameOver(startY: number): void {
    const { width } = this.scale

    this.add
      .text(width / 2, startY + 10, 'GAME OVER', {
        fontSize: '28px',
        fontFamily: 'monospace',
        color: '#ef4444',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, startY + 45, 'The mob sends its regards.', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#f87171',
      })
      .setOrigin(0.5)

    // Final stats
    let sy = startY + 75
    const peakCapital = Math.max(
      gameState.startingCapital,
      ...gameState.dayResults.map((d) => d.endingCapital)
    )
    const totalTrades = gameState.allTrades.length

    const stats = [
      `Days Survived: ${gameState.dayNumber}`,
      `Peak Capital: $${peakCapital.toFixed(2)}`,
      `Total Trades: ${totalTrades}`,
      `Final Capital: $${gameState.capital.toFixed(2)}`,
    ]

    for (const stat of stats) {
      this.add
        .text(width / 2, sy, stat, {
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#94a3b8',
        })
        .setOrigin(0.5)
      sy += 20
    }

    // Try Again button
    const btn = this.add.rectangle(width / 2, sy + 20, 200, 40, 0xdc2626)
    btn.setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, sy + 20, 'TRY AGAIN', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

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
      // Ran out of market data — you win
      gameState.isGameOver = true
      this.scene.restart()
      return
    }
    gameState.currentDate = nextDate
    gameState.phase = 'morning'
    this.scene.start('MorningScene')
  }
}
