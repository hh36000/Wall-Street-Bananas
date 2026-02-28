import Phaser from 'phaser'
import { marketData } from '../systems/MarketDataEngine'
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

    const title = this.add.text(width / 2, height / 2 - 80, 'WALL STREET BANANAS', {
      fontSize: '32px',
      fontFamily: '"Press Start 2P"',
      color: '#facc15',
    })
    title.setOrigin(0.5)

    const hackathon = this.add.text(width / 2, height / 2 - 48, 'Gemini 3 NYC Hackathon', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#94a3b8',
    })
    hackathon.setOrigin(0.5)

    const subtitle = this.add.text(width / 2, height / 2 - 28, 'Loading...', {
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

    // Player sprite
    this.load.image('player-tp', '/game-assets/sprites/player-tp.png')

    // NPC sprites — load all trader images
    // These three have the -tp suffix in filename
    const tpSprites = ['vinny-tp', 'margaret-tp', 'mama-tp']
    for (const name of tpSprites) {
      this.load.image(name, `/game-assets/sprites/${name}.png`)
    }
    // All other traders use their id as filename
    const otherSprites = [
      'bigal', 'professor', 'donna', 'quietmike', 'tommy', 'santos',
      'ricky', 'eddie', 'sal', 'paulie', 'tony', 'nancy', 'bernie',
      'charlie', 'diane', 'bobby', 'tina', 'jerome', 'gus', 'maddog',
      'whitey',
    ]
    for (const name of otherSprites) {
      this.load.image(name, `/game-assets/sprites/${name}.png`)
    }

    // Music
    this.load.audio('music-morning', '/game-assets/music/Wall_Street_Drive.mp3')
    this.load.audio('music-trading', '/game-assets/music/Wall_Street_Warrior.mp3')
    this.load.audio('music-summary', '/game-assets/music/Neon_Horizon_Glide.mp3')

    // Market data JSON
    this.load.json('market-data', '/game-assets/data/market-data.json')
  }

  create(): void {
    // Initialize market data engine
    const json = this.cache.json.get('market-data') as MarketDataJSON
    marketData.load(json)

    // All traders now have sprite images — no placeholder generation needed


    // Transition to morning scene
    this.scene.start('MorningScene')
  }

}
