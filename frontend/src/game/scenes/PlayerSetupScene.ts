import Phaser from 'phaser'
import { gameState } from '../GameState'
import { SaveManager } from '../systems/SaveManager'
import { marketData } from '../systems/MarketDataEngine'

export class PlayerSetupScene extends Phaser.Scene {
  constructor() {
    super('PlayerSetupScene')
  }

  create(): void {
    const { width, height } = this.scale

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a)

    // Title
    this.add
      .text(width / 2, 80, 'WALL STREET BANANAS', {
        fontSize: '32px',
        fontFamily: '"Press Start 2P"',
        color: '#facc15',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 128, 'Gemini 3 NYC Hackathon', {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    const summary = SaveManager.getSaveSummary()
    if (summary) {
      this.showContinueScreen(summary)
    } else {
      this.showNameEntry()
    }
  }

  private showNameEntry(): void {
    const { width, height } = this.scale

    this.add
      .text(width / 2, height / 2 - 80, 'ENTER YOUR NAME, TRADER', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#39ff14',
      })
      .setOrigin(0.5)

    // DOM input element for real keyboard input
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
    // Auto-focus after a short delay to ensure DOM is ready
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
      marketData.setDateIndex(0)
      SaveManager.save()
      this.scene.start('MorningScene')
    }

    btn.on('pointerdown', startGame)
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') startGame()
    })
  }

  private showContinueScreen(summary: { playerName: string; dayNumber: number; cumulativePnl: number }): void {
    const { width, height } = this.scale

    const fmt = (v: number) =>
      Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // Save summary
    this.add
      .text(width / 2, height / 2 - 100, 'SAVED GAME FOUND', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#39ff14',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 - 60, `Trader: ${summary.playerName}`, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height / 2 - 36, `Day ${summary.dayNumber}`, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)

    const pnlColor = summary.cumulativePnl >= 0 ? '#4ade80' : '#f87171'
    const pnlSign = summary.cumulativePnl >= 0 ? '+' : '-'
    this.add
      .text(width / 2, height / 2 - 12, `P&L: ${pnlSign}$${fmt(summary.cumulativePnl)}`, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: pnlColor,
      })
      .setOrigin(0.5)

    // Continue button
    const continueBtn = this.add.rectangle(width / 2, height / 2 + 40, 220, 45, 0x16a34a)
    continueBtn.setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, height / 2 + 40, 'CONTINUE', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    continueBtn.on('pointerover', () => continueBtn.setFillStyle(0x22c55e))
    continueBtn.on('pointerout', () => continueBtn.setFillStyle(0x16a34a))
    continueBtn.on('pointerdown', () => {
      SaveManager.load()
      marketData.advanceToDate(gameState.currentDate)
      this.scene.start('MorningScene')
    })

    // New Game button
    const newBtn = this.add.rectangle(width / 2, height / 2 + 100, 220, 45, 0x475569)
    newBtn.setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, height / 2 + 100, 'NEW GAME', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    newBtn.on('pointerover', () => newBtn.setFillStyle(0x64748b))
    newBtn.on('pointerout', () => newBtn.setFillStyle(0x475569))
    newBtn.on('pointerdown', () => {
      SaveManager.deleteSave()
      // Clear this scene and show name entry
      this.scene.restart()
    })
  }
}
