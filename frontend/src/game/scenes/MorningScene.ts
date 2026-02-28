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

    // Number formatting: 2 decimals + commas
    const fmt = (v: number, decimals = 2) =>
      v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })

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
          `${arrow} ${mover.ticker}: $${fmt(price)} (${mover.pctChange >= 0 ? '+' : ''}${fmt(mover.pctChange)}%)`,
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
            `Yesterday's P&L: ${pnlSign}$${fmt(Math.abs(lastResult.netPnl))}`,
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
      .text(width / 2, infoY, `Capital: $${fmt(gameState.capital)}`, {
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

    // Portfolio exposure table
    if (gameState.positions.size > 0) {
      const fmtPct = (v: number) =>
        `${v >= 0 ? '+' : ''}${fmt(v)}%`
      const clr = (v: number) => (v >= 0 ? '#4ade80' : '#f87171')

      infoY += 5
      this.add
        .text(width / 2, infoY, '──── PORTFOLIO ────', {
          fontSize: '13px',
          fontFamily: 'monospace',
          color: '#facc15',
        })
        .setOrigin(0.5)
      infoY += 20

      // Column right-edge positions (right-aligned except TKR)
      const col = {
        tkr: 200,
        yday: 320,
        today: 430,
        chg: 530,
        shrs: 620,
        cost: 740,
        mv: 860,
        onPct: 980,
        totPct: 1100,
      }
      const hdr = { fontSize: '10px', fontFamily: 'monospace', color: '#64748b' }
      const cell = { fontSize: '10px', fontFamily: 'monospace', color: '#e2e8f0' }

      // Column headers
      this.add.text(col.tkr, infoY, 'TKR', hdr)
      this.add.text(col.yday, infoY, 'YDAY', hdr).setOrigin(1, 0)
      this.add.text(col.today, infoY, 'TODAY', hdr).setOrigin(1, 0)
      this.add.text(col.chg, infoY, 'CHG%', hdr).setOrigin(1, 0)
      this.add.text(col.shrs, infoY, 'SHRS', hdr).setOrigin(1, 0)
      this.add.text(col.cost, infoY, 'COST', hdr).setOrigin(1, 0)
      this.add.text(col.mv, infoY, 'MV', hdr).setOrigin(1, 0)
      this.add.text(col.onPct, infoY, 'O/N%', hdr).setOrigin(1, 0)
      this.add.text(col.totPct, infoY, 'TOT%', hdr).setOrigin(1, 0)
      infoY += 14

      // Header underline
      this.add
        .text(width / 2, infoY, '─'.repeat(80), {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#334155',
        })
        .setOrigin(0.5)
      infoY += 12

      let totalCost = 0
      let totalMV = 0
      let totalONPnl = 0
      let totalPosPnl = 0
      let totalPrevValue = 0

      for (const pos of gameState.positions.values()) {
        const currentPrice = marketData.getPrice(pos.ticker) ?? pos.avgPrice
        const previousPrice =
          marketData.getPreviousPrice(pos.ticker) ?? pos.avgPrice
        const absQty = Math.abs(pos.quantity)
        const side = pos.quantity >= 0 ? 'L' : 'S'

        const costBasis = absQty * pos.avgPrice
        const mktValue = absQty * currentPrice
        const prevDayValue = absQty * previousPrice
        const overnightPnl = (currentPrice - previousPrice) * pos.quantity
        const positionPnl = (currentPrice - pos.avgPrice) * pos.quantity

        const stockChgPct =
          previousPrice !== 0
            ? ((currentPrice - previousPrice) / previousPrice) * 100
            : 0
        const onPct =
          prevDayValue > 0 ? (overnightPnl / prevDayValue) * 100 : 0
        const totPct =
          costBasis > 0 ? (positionPnl / costBasis) * 100 : 0

        totalCost += costBasis
        totalMV += mktValue
        totalONPnl += overnightPnl
        totalPosPnl += positionPnl
        totalPrevValue += prevDayValue

        // Data row
        this.add.text(col.tkr, infoY, `${pos.ticker} ${side}`, cell)
        this.add
          .text(col.yday, infoY, `$${fmt(previousPrice)}`, cell)
          .setOrigin(1, 0)
        this.add
          .text(col.today, infoY, `$${fmt(currentPrice)}`, cell)
          .setOrigin(1, 0)
        this.add
          .text(col.chg, infoY, fmtPct(stockChgPct), {
            ...cell,
            color: clr(stockChgPct),
          })
          .setOrigin(1, 0)
        this.add
          .text(col.shrs, infoY, fmt(absQty, 0), cell)
          .setOrigin(1, 0)
        this.add
          .text(col.cost, infoY, `$${fmt(costBasis)}`, cell)
          .setOrigin(1, 0)
        this.add
          .text(col.mv, infoY, `$${fmt(mktValue)}`, cell)
          .setOrigin(1, 0)
        this.add
          .text(col.onPct, infoY, fmtPct(onPct), {
            ...cell,
            color: clr(onPct),
          })
          .setOrigin(1, 0)
        this.add
          .text(col.totPct, infoY, fmtPct(totPct), {
            ...cell,
            color: clr(totPct),
          })
          .setOrigin(1, 0)
        infoY += 16
      }

      // Totals separator
      this.add
        .text(width / 2, infoY, '─'.repeat(80), {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#334155',
        })
        .setOrigin(0.5)
      infoY += 14

      // Totals row
      const totalOnPct =
        totalPrevValue > 0 ? (totalONPnl / totalPrevValue) * 100 : 0
      const totalTotPct =
        totalCost > 0 ? (totalPosPnl / totalCost) * 100 : 0
      const totStyle = { fontSize: '10px', fontFamily: 'monospace', color: '#facc15' }

      this.add.text(col.tkr, infoY, 'TOTAL', totStyle)
      this.add
        .text(col.cost, infoY, `$${fmt(totalCost)}`, totStyle)
        .setOrigin(1, 0)
      this.add
        .text(col.mv, infoY, `$${fmt(totalMV)}`, totStyle)
        .setOrigin(1, 0)
      this.add
        .text(col.onPct, infoY, fmtPct(totalOnPct), {
          ...totStyle,
          color: clr(totalOnPct),
        })
        .setOrigin(1, 0)
      this.add
        .text(col.totPct, infoY, fmtPct(totalTotPct), {
          ...totStyle,
          color: clr(totalTotPct),
        })
        .setOrigin(1, 0)
      infoY += 20
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
