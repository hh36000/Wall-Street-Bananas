import Phaser from 'phaser'
import { marketData } from '../systems/MarketDataEngine'
import { TRADERS } from '../data/traders'
import type { MarketDataJSON } from '../types'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload(): void {
    // --- Loading bar ---
    const { width, height } = this.scale
    const barWidth = 400
    const barHeight = 30

    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a)
    bg.setOrigin(0.5)

    const title = this.add.text(width / 2, height / 2 - 80, 'WALL ST BANANAS', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#facc15',
    })
    title.setOrigin(0.5)

    const subtitle = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#666',
    })
    subtitle.setOrigin(0.5)

    const barBg = this.add.rectangle(width / 2, height / 2, barWidth, barHeight, 0x222244)
    barBg.setOrigin(0.5)

    const barFill = this.add.rectangle(
      width / 2 - barWidth / 2,
      height / 2,
      0,
      barHeight - 4,
      0x4ade80
    )
    barFill.setOrigin(0, 0.5)

    this.load.on('progress', (value: number) => {
      barFill.width = (barWidth - 4) * value
    })

    this.load.on('complete', () => {
      subtitle.setText('Ready!')
    })

    // --- Load assets ---

    // Trading floor background
    this.load.image('trading-floor', '/game-assets/screens/trading_floor.png')

    // Player uses a rectangle now — skip loading the oversized PNG

    // NPC sprites (only load ones that exist as files)
    const existingSprites = ['vinny-tp', 'margaret-tp', 'mama-tp']
    for (const name of existingSprites) {
      this.load.image(name, `/game-assets/sprites/${name}.png`)
    }

    // Market data JSON
    this.load.json('market-data', '/game-assets/data/market-data.json')
  }

  create(): void {
    // Initialize market data engine
    const json = this.cache.json.get('market-data') as MarketDataJSON
    marketData.load(json)

    // Generate placeholder textures for NPCs that don't have sprite files
    const existingSpriteIds = new Set(['vinny', 'margaret', 'mama'])

    for (const trader of TRADERS) {
      if (!existingSpriteIds.has(trader.id)) {
        this.generatePlaceholderSprite(trader.id, trader.color, trader.nickname[0])
      }
    }

    // Generate player sprite placeholder if the loaded image is too large
    // (the real player.png is 1MB which might be huge - we'll use it but scale down)

    // Transition to morning scene
    this.scene.start('MorningScene')
  }

  private generatePlaceholderSprite(id: string, color: number, initial: string): void {
    const size = 32
    const graphics = this.add.graphics()

    // Body circle
    graphics.fillStyle(color, 1)
    graphics.fillCircle(size / 2, size / 2, size / 2 - 2)

    // Border
    graphics.lineStyle(2, 0xffffff, 0.5)
    graphics.strokeCircle(size / 2, size / 2, size / 2 - 2)

    // Generate texture
    graphics.generateTexture(id, size, size)
    graphics.destroy()

    // Add initial letter as a separate step (text can't go into generateTexture easily)
    // We'll handle the initial display in the TradingFloor scene directly
  }
}
