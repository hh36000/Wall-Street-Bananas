import Phaser from 'phaser'
import { gameState } from '../GameState'
import { marketData } from '../systems/MarketDataEngine'
import { playLoopedMusic } from '../systems/MusicManager'

export class MorningScene extends Phaser.Scene {
  private music!: Phaser.Sound.WebAudioSound

  constructor() {
    super('MorningScene')
  }

  create(): void {
    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }

    // Play morning music (looped from 0:27 with crossfade)
    this.music = playLoopedMusic(this, 'music-morning')

    // Fill in nextDayPrice for previous day's NPC interactions
    if (gameState.dayNumber > 1) {
      const prevDay = gameState.dayNumber - 1
      for (const entries of gameState.npcMemory.values()) {
        for (const entry of entries) {
          if (entry.day === prevDay && entry.nextDayPrice == null) {
            const price = marketData.getPrice(entry.ticker)
            if (price != null) {
              entry.nextDayPrice = price
            }
          }
        }
      }
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
      .text(width / 2, 40, 'WALL STREET BANANAS', {
        fontSize: '32px',
        fontFamily: '"Press Start 2P"',
        color: '#facc15',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 88, 'Gemini 3 NYC Hackathon', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    // Date
    const formattedDate = marketData.formatDate(gameState.currentDate)
    this.add
      .text(width / 2, 126, formattedDate, {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)

    // Day number
    this.add
      .text(width / 2, 156, `Day ${gameState.dayNumber}`, {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    // Cumulative P&L
    const cumPnlColor = gameState.cumulativePnl >= 0 ? '#4ade80' : '#f87171'
    const cumPnlSign = gameState.cumulativePnl >= 0 ? '+' : '-'
    this.add
      .text(width / 2, 188, `Cumulative P&L: ${cumPnlSign}$${fmt(Math.abs(gameState.cumulativePnl))}`, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: cumPnlColor,
      })
      .setOrigin(0.5)

    // Separator
    this.add
      .text(width / 2, 205, '─'.repeat(40), {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#334155',
      })
      .setOrigin(0.5)

    // ─── Instructions container ───
    const instructionsContainer = this.add.container(0, 0)
    let iy = 230

    instructionsContainer.add(
      this.add.text(width / 2, iy, 'INSTRUCTIONS', {
        fontSize: '14px', fontFamily: 'monospace', color: '#facc15',
      }).setOrigin(0.5)
    )
    iy += 30

    const instructions = [
      '',
      '- HOW TO PLAY -',
      '▸ Walk the floor and negotiate with traders',
      '▸ Negotiate with traders to get the best price.',
      '▸ Buy low, sell high. Grow your capital.',

      '',
      '- REMEMBER -',
      '▸ Each trader has a weakness, try to exploit it.',
      '▸ Traders remember how you treat them in the past.',
      '▸ Burn a relationship and they won\'t deal.',
      '▸ Traders who like you more will give you better prices.',
    ]
    for (const line of instructions) {
      instructionsContainer.add(
        this.add.text(width / 2, iy, line, {
          fontSize: '16px', fontFamily: 'monospace', color: '#94a3b8',
        }).setOrigin(0.5)
      )
      iy += 26
    }

    // ─── Market brief container ───
    const briefContainer = this.add.container(0, 0)
    let by = 230

    const movers = marketData.getBiggestMovers(gameState.currentDate, 3)
    briefContainer.add(
      this.add.text(width / 2, by, 'MARKET BRIEF', {
        fontSize: '14px', fontFamily: 'monospace', color: '#facc15',
      }).setOrigin(0.5)
    )
    by += 30

    for (const mover of movers) {
      const arrow = mover.pctChange >= 0 ? '▲' : '▼'
      const color = mover.pctChange >= 0 ? '#4ade80' : '#f87171'
      const price = marketData.getPrice(mover.ticker) ?? 0
      briefContainer.add(
        this.add.text(
          width / 2, by,
          `${arrow} ${mover.ticker}: $${fmt(price)} (${mover.pctChange >= 0 ? '+' : ''}${fmt(mover.pctChange)}%)`,
          { fontSize: '13px', fontFamily: 'monospace', color }
        ).setOrigin(0.5)
      )
      by += 22
    }

    // Yesterday's P&L (skip on day 1)
    if (gameState.dayNumber > 1) {
      by += 10
      const lastResult = gameState.dayResults[gameState.dayResults.length - 1]
      if (lastResult) {
        const pnlColor = lastResult.netPnl >= 0 ? '#4ade80' : '#f87171'
        const pnlSign = lastResult.netPnl >= 0 ? '+' : ''
        briefContainer.add(
          this.add.text(
            width / 2, by,
            `Yesterday's P&L: ${pnlSign}$${fmt(Math.abs(lastResult.netPnl))}`,
            { fontSize: '14px', fontFamily: 'monospace', color: pnlColor }
          ).setOrigin(0.5)
        )
        by += 25
      }
    }

    // ─── Default visibility: Day 1 shows instructions, Day 2+ shows brief ───
    let showingInstructions = gameState.dayNumber === 1
    instructionsContainer.setVisible(showingInstructions)
    briefContainer.setVisible(!showingInstructions)

    // ─── Toggle button ───
    const toggleY = 212
    const toggleLabel = this.add
      .text(width - 30, toggleY, showingInstructions ? 'BRIEF ?' : 'HELP ?', {
        fontSize: '10px', fontFamily: 'monospace', color: '#475569',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })

    toggleLabel.on('pointerover', () => toggleLabel.setColor('#94a3b8'))
    toggleLabel.on('pointerout', () => toggleLabel.setColor('#475569'))
    toggleLabel.on('pointerdown', () => {
      showingInstructions = !showingInstructions
      instructionsContainer.setVisible(showingInstructions)
      briefContainer.setVisible(!showingInstructions)
      toggleLabel.setText(showingInstructions ? 'BRIEF ?' : 'HELP ?')
      buildPortfolioAndButton(showingInstructions ? iy : by)
    })

    // Portfolio + button are placed below whichever container is visible
    const startTrading = () => {
      this.music.stop()
      this.scene.start('TradingFloorScene')
    }

    const portfolioContainer = this.add.container(0, 0)
    const buildPortfolioAndButton = (baseY: number) => {
      portfolioContainer.removeAll(true)
      let infoY = baseY + 10

      // Portfolio exposure table
      if (gameState.positions.size > 0) {
        const fmtPct = (v: number) =>
          `${v >= 0 ? '+' : ''}${fmt(v)}%`
        const clr = (v: number) => (v >= 0 ? '#4ade80' : '#f87171')

        infoY += 5
        portfolioContainer.add(
          this.add
            .text(width / 2, infoY, '──── PORTFOLIO ────', {
              fontSize: '13px',
              fontFamily: 'monospace',
              color: '#facc15',
            })
            .setOrigin(0.5)
        )
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
        portfolioContainer.add(this.add.text(col.tkr, infoY, 'TKR', hdr))
        portfolioContainer.add(this.add.text(col.yday, infoY, 'YDAY', hdr).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.today, infoY, 'TODAY', hdr).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.chg, infoY, 'CHG%', hdr).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.shrs, infoY, 'SHRS', hdr).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.cost, infoY, 'COST', hdr).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.mv, infoY, 'MV', hdr).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.onPct, infoY, 'O/N%', hdr).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.totPct, infoY, 'TOT%', hdr).setOrigin(1, 0))
        infoY += 14

        // Header underline
        portfolioContainer.add(
          this.add
            .text(width / 2, infoY, '─'.repeat(80), {
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#334155',
            })
            .setOrigin(0.5)
        )
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
          portfolioContainer.add(this.add.text(col.tkr, infoY, `${pos.ticker} ${side}`, cell))
          portfolioContainer.add(this.add.text(col.yday, infoY, `$${fmt(previousPrice)}`, cell).setOrigin(1, 0))
          portfolioContainer.add(this.add.text(col.today, infoY, `$${fmt(currentPrice)}`, cell).setOrigin(1, 0))
          portfolioContainer.add(this.add.text(col.chg, infoY, fmtPct(stockChgPct), { ...cell, color: clr(stockChgPct) }).setOrigin(1, 0))
          portfolioContainer.add(this.add.text(col.shrs, infoY, fmt(absQty, 0), cell).setOrigin(1, 0))
          portfolioContainer.add(this.add.text(col.cost, infoY, `$${fmt(costBasis)}`, cell).setOrigin(1, 0))
          portfolioContainer.add(this.add.text(col.mv, infoY, `$${fmt(mktValue)}`, cell).setOrigin(1, 0))
          portfolioContainer.add(this.add.text(col.onPct, infoY, fmtPct(onPct), { ...cell, color: clr(onPct) }).setOrigin(1, 0))
          portfolioContainer.add(this.add.text(col.totPct, infoY, fmtPct(totPct), { ...cell, color: clr(totPct) }).setOrigin(1, 0))
          infoY += 16
        }

        // Totals separator
        portfolioContainer.add(
          this.add
            .text(width / 2, infoY, '─'.repeat(80), {
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#334155',
            })
            .setOrigin(0.5)
        )
        infoY += 14

        // Totals row
        const totalOnPct =
          totalPrevValue > 0 ? (totalONPnl / totalPrevValue) * 100 : 0
        const totalTotPct =
          totalCost > 0 ? (totalPosPnl / totalCost) * 100 : 0
        const totStyle = { fontSize: '10px', fontFamily: 'monospace', color: '#facc15' }

        portfolioContainer.add(this.add.text(col.tkr, infoY, 'TOTAL', totStyle))
        portfolioContainer.add(this.add.text(col.cost, infoY, `$${fmt(totalCost)}`, totStyle).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.mv, infoY, `$${fmt(totalMV)}`, totStyle).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.onPct, infoY, fmtPct(totalOnPct), { ...totStyle, color: clr(totalOnPct) }).setOrigin(1, 0))
        portfolioContainer.add(this.add.text(col.totPct, infoY, fmtPct(totalTotPct), { ...totStyle, color: clr(totalTotPct) }).setOrigin(1, 0))
        infoY += 20
      }

      // Start Trading button
      const btnY = Math.max(infoY + 40, height - 80)
      const btn = this.add.rectangle(width / 2, btnY, 220, 45, 0x16a34a)
      btn.setInteractive({ useHandCursor: true })
      portfolioContainer.add(btn)

      portfolioContainer.add(
        this.add
          .text(width / 2, btnY, 'START TRADING (S)', {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#ffffff',
          })
          .setOrigin(0.5)
      )

      btn.on('pointerover', () => btn.setFillStyle(0x22c55e))
      btn.on('pointerout', () => btn.setFillStyle(0x16a34a))
      btn.on('pointerdown', startTrading)
    }

    // Initial layout based on which container is visible
    buildPortfolioAndButton(showingInstructions ? iy : by)

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S).on('down', startTrading)
  }
}
