import Phaser from 'phaser'
import { gameState } from '../GameState'
import { marketData } from '../systems/MarketDataEngine'

export class MorningScene extends Phaser.Scene {
  constructor() {
    super('MorningScene')
  }

  create(): void {
    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }

    const { width, height } = this.scale

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a)

    // Title
    this.add
      .text(width / 2, 40, 'WALL ST BANANAS', {
        fontSize: '28px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5)

    // Date
    const formattedDate = marketData.formatDate(gameState.currentDate)
    this.add
      .text(width / 2, 85, formattedDate, {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)

    // Day number
    this.add
      .text(width / 2, 115, `Day ${gameState.dayNumber}`, {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    // Separator
    this.add
      .text(width / 2, 145, '─'.repeat(40), {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#334155',
      })
      .setOrigin(0.5)

    // News headlines (placeholder - will be AI-generated in step 8)
    const movers = marketData.getBiggestMovers(gameState.currentDate, 3)
    let newsY = 170
    this.add
      .text(width / 2, newsY, 'MARKET BRIEF', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5)

    newsY += 30
    for (const mover of movers) {
      const arrow = mover.pctChange >= 0 ? '▲' : '▼'
      const color = mover.pctChange >= 0 ? '#4ade80' : '#f87171'
      const price = marketData.getPrice(mover.ticker) ?? 0
      this.add
        .text(
          width / 2,
          newsY,
          `${arrow} ${mover.ticker}: $${price.toFixed(2)} (${mover.pctChange >= 0 ? '+' : ''}${mover.pctChange.toFixed(1)}%)`,
          {
            fontSize: '13px',
            fontFamily: 'monospace',
            color,
          }
        )
        .setOrigin(0.5)
      newsY += 22
    }

    // Yesterday's P&L (skip on day 1)
    let infoY = newsY + 20
    if (gameState.dayNumber > 1) {
      const lastResult = gameState.dayResults[gameState.dayResults.length - 1]
      if (lastResult) {
        const pnlColor = lastResult.netPnl >= 0 ? '#4ade80' : '#f87171'
        const pnlSign = lastResult.netPnl >= 0 ? '+' : ''
        this.add
          .text(
            width / 2,
            infoY,
            `Yesterday's P&L: ${pnlSign}$${lastResult.netPnl.toFixed(2)}`,
            {
              fontSize: '14px',
              fontFamily: 'monospace',
              color: pnlColor,
            }
          )
          .setOrigin(0.5)
        infoY += 25
      }
    }

    // Capital
    const capitalColor = gameState.capital >= 0 ? '#4ade80' : '#f87171'
    this.add
      .text(width / 2, infoY, `Capital: $${gameState.capital.toFixed(2)}`, {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: capitalColor,
      })
      .setOrigin(0.5)
    infoY += 25

    // Debt warning
    if (gameState.isInDebt) {
      this.add
        .text(
          width / 2,
          infoY,
          `⚠ IN DEBT: Day ${gameState.consecutiveDaysInDebt} of 3`,
          {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#f87171',
          }
        )
        .setOrigin(0.5)
      infoY += 25
    }

    // Open positions
    if (gameState.positions.size > 0) {
      infoY += 10
      this.add
        .text(width / 2, infoY, 'Open Positions:', {
          fontSize: '13px',
          fontFamily: 'monospace',
          color: '#94a3b8',
        })
        .setOrigin(0.5)
      infoY += 20

      for (const pos of gameState.positions.values()) {
        const currentPrice = marketData.getPrice(pos.ticker) ?? pos.avgPrice
        const marketValue = pos.quantity * currentPrice
        const pnl = (currentPrice - pos.avgPrice) * pos.quantity
        const pnlColor = pnl >= 0 ? '#4ade80' : '#f87171'
        const mvSign = marketValue >= 0 ? '+' : '-'
        const side = pos.quantity >= 0 ? 'LONG' : 'SHORT'
        this.add
          .text(
            width / 2,
            infoY,
            `${pos.ticker}: ${side} ${Math.abs(pos.quantity)} | MV ${mvSign}$${Math.abs(marketValue).toFixed(0)} @ $${pos.avgPrice.toFixed(2)}`,
            {
              fontSize: '12px',
              fontFamily: 'monospace',
              color: pnlColor,
            }
          )
          .setOrigin(0.5)
        infoY += 18
      }
    }

    // Start Trading button
    const btnY = Math.max(infoY + 40, height - 80)
    const btn = this.add.rectangle(width / 2, btnY, 220, 45, 0x16a34a)
    btn.setInteractive({ useHandCursor: true })

    const btnText = this.add
      .text(width / 2, btnY, 'START TRADING', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    btn.on('pointerover', () => {
      btn.setFillStyle(0x22c55e)
    })
    btn.on('pointerout', () => {
      btn.setFillStyle(0x16a34a)
    })
    btn.on('pointerdown', () => {
      this.scene.start('TradingFloorScene')
    })
  }
}
