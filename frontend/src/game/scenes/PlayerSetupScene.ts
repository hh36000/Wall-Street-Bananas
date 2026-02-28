import Phaser from 'phaser'
import { gameState } from '../GameState'
import { SaveManager, type SlotSummary } from '../systems/SaveManager'
import { marketData } from '../systems/MarketDataEngine'

export class PlayerSetupScene extends Phaser.Scene {
  private pendingSlot: number | null = null

  constructor() {
    super('PlayerSetupScene')
  }

  init(data?: { pendingSlot?: number }): void {
    this.pendingSlot = data?.pendingSlot ?? null
  }

  create(): void {
    const { width } = this.scale

    // Dark background
    this.add.rectangle(width / 2, 360, width, 720, 0x0a0a1a)

    // Title
    this.add
      .text(width / 2, 60, 'WALL STREET BANANAS', {
        fontSize: '32px',
        fontFamily: '"Press Start 2P"',
        color: '#facc15',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 108, 'Gemini 3 NYC Hackathon', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    if (this.pendingSlot) {
      this.showNameEntry(this.pendingSlot)
    } else {
      const loadingText = this.add
        .text(width / 2, 360, 'Loading saves...', {
          fontSize: '14px',
          fontFamily: 'monospace',
          color: '#475569',
        })
        .setOrigin(0.5)

      SaveManager.listSlots().then((slots) => {
        loadingText.destroy()
        this.showSlots(slots)
      })
    }
  }

  private showSlots(slots: SlotSummary[]): void {
    const { width } = this.scale

    this.add
      .text(width / 2, 155, 'SELECT SAVE SLOT', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#39ff14',
      })
      .setOrigin(0.5)

    const fmt = (v: number) =>
      Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const slotHeight = 110
    const startY = 210

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const y = startY + i * (slotHeight + 16)

      // Slot background
      const bg = this.add.rectangle(width / 2, y + slotHeight / 2, 500, slotHeight, 0x1e293b)
      bg.setStrokeStyle(1, 0x334155)

      // Slot number
      this.add.text(width / 2 - 220, y + 15, `SLOT ${slot.slot}`, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#64748b',
      })

      if (slot.empty) {
        this.add
          .text(width / 2, y + slotHeight / 2, '- EMPTY -', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#475569',
          })
          .setOrigin(0.5)

        const newBtn = this.add.rectangle(width / 2 + 180, y + slotHeight / 2, 100, 32, 0x16a34a)
        newBtn.setInteractive({ useHandCursor: true })
        this.add
          .text(width / 2 + 180, y + slotHeight / 2, 'NEW', {
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#ffffff',
          })
          .setOrigin(0.5)

        newBtn.on('pointerover', () => newBtn.setFillStyle(0x22c55e))
        newBtn.on('pointerout', () => newBtn.setFillStyle(0x16a34a))
        newBtn.on('pointerdown', () => {
          this.scene.restart({ pendingSlot: slot.slot })
        })
      } else {
        this.add.text(width / 2 - 220, y + 35, slot.playerName!, {
          fontSize: '16px',
          fontFamily: 'monospace',
          color: '#e2e8f0',
        })

        this.add.text(width / 2 - 220, y + 60, `Day ${slot.dayNumber}`, {
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#94a3b8',
        })

        const pnl = slot.cumulativePnl!
        const pnlColor = pnl >= 0 ? '#4ade80' : '#f87171'
        const pnlSign = pnl >= 0 ? '+' : '-'
        this.add.text(width / 2 - 220, y + 80, `P&L: ${pnlSign}$${fmt(pnl)}`, {
          fontSize: '12px',
          fontFamily: 'monospace',
          color: pnlColor,
        })

        // Continue button
        const contBtn = this.add.rectangle(width / 2 + 120, y + slotHeight / 2, 110, 32, 0x16a34a)
        contBtn.setInteractive({ useHandCursor: true })
        this.add
          .text(width / 2 + 120, y + slotHeight / 2, 'CONTINUE', {
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#ffffff',
          })
          .setOrigin(0.5)

        contBtn.on('pointerover', () => contBtn.setFillStyle(0x22c55e))
        contBtn.on('pointerout', () => contBtn.setFillStyle(0x16a34a))
        contBtn.on('pointerdown', async () => {
          const loaded = await SaveManager.load(slot.slot)
          if (loaded) {
            marketData.advanceToDate(gameState.currentDate)
          }
          this.scene.start('MorningScene')
        })

        // Delete button
        const delBtn = this.add.rectangle(width / 2 + 210, y + slotHeight / 2, 32, 32, 0x7f1d1d)
        delBtn.setInteractive({ useHandCursor: true })
        this.add
          .text(width / 2 + 210, y + slotHeight / 2, 'X', {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#fca5a5',
          })
          .setOrigin(0.5)

        delBtn.on('pointerover', () => delBtn.setFillStyle(0x991b1b))
        delBtn.on('pointerout', () => delBtn.setFillStyle(0x7f1d1d))
        delBtn.on('pointerdown', () => {
          SaveManager.deleteSave(slot.slot)
          this.scene.restart()
        })
      }
    }
  }

  private showNameEntry(slot: number): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height / 2 - 80, `SLOT ${slot} — ENTER YOUR NAME, TRADER`, {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#39ff14',
      })
      .setOrigin(0.5)

    const inputHtml = `<input type="text" maxlength="20" placeholder="Your name..." style="
      width: 280px;
      padding: 10px 16px;
      font-size: 18px;
      font-family: monospace;
      background: #1e293b;
      border: 2px solid #39ff14;
      color: #e2e8f0;
      text-align: center;
      outline: none;
      border-radius: 4px;
    " />`

    const inputElement = this.add.dom(width / 2, height / 2 - 30).createFromHTML(inputHtml)
    const input = inputElement.node.querySelector('input') as HTMLInputElement
    this.time.delayedCall(100, () => input.focus())

    // Start Game button
    const btn = this.add.rectangle(width / 2, height / 2 + 50, 220, 45, 0x16a34a)
    btn.setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, height / 2 + 50, 'START GAME', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    btn.on('pointerover', () => btn.setFillStyle(0x22c55e))
    btn.on('pointerout', () => btn.setFillStyle(0x16a34a))

    const startGame = () => {
      const name = input.value.trim()
      if (!name) return
      gameState.reset()
      gameState.playerName = name
      gameState.saveSlot = slot
      marketData.setDateIndex(0)
      SaveManager.save(slot)
      this.scene.start('MorningScene')
    }

    btn.on('pointerdown', startGame)
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') startGame()
    })

    // Back button
    const backBtn = this.add.rectangle(width / 2, height / 2 + 110, 120, 35, 0x475569)
    backBtn.setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, height / 2 + 110, 'BACK', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    backBtn.on('pointerover', () => backBtn.setFillStyle(0x64748b))
    backBtn.on('pointerout', () => backBtn.setFillStyle(0x475569))
    backBtn.on('pointerdown', () => this.scene.restart())
  }
}
