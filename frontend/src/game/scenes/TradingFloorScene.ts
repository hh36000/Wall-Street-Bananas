import Phaser from 'phaser'
import { gameState } from '../GameState'
import { tradingSystem } from '../systems/TradingSystem'
import { TRADERS } from '../data/traders'
import type { TraderDef } from '../types'
import { TradingUIScene } from './TradingUIScene'

// NPC positions scattered across the 1408x768 trading floor
const NPC_POSITIONS: Record<string, { x: number; y: number }> = {
  vinny: { x: 200, y: 200 },
  margaret: { x: 450, y: 150 },
  bigal: { x: 700, y: 180 },
  professor: { x: 950, y: 160 },
  donna: { x: 1200, y: 200 },
  quietmike: { x: 150, y: 350 },
  tommy: { x: 380, y: 320 },
  santos: { x: 600, y: 380 },
  ricky: { x: 850, y: 340 },
  eddie: { x: 1100, y: 370 },
  sal: { x: 1300, y: 330 },
  paulie: { x: 250, y: 500 },
  tony: { x: 500, y: 520 },
  nancy: { x: 750, y: 480 },
  bernie: { x: 1000, y: 510 },
  charlie: { x: 1250, y: 490 },
  diane: { x: 180, y: 630 },
  bobby: { x: 420, y: 660 },
  tina: { x: 650, y: 620 },
  jerome: { x: 900, y: 650 },
  gus: { x: 1150, y: 630 },
  maddog: { x: 1350, y: 600 },
  whitey: { x: 350, y: 450 },
  mama: { x: 1050, y: 250 },
  frank: { x: 730, y: 280 },
}

const PLAYER_SPEED = 200
const CAMERA_ZOOM = 1
const INTERACT_DISTANCE = 50

export class TradingFloorScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>
  private interactKey!: Phaser.Input.Keyboard.Key

  private npcSprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private npcTraders: Map<string, TraderDef> = new Map()

  private nearestNPC: string | null = null
  private promptText!: Phaser.GameObjects.Text

  private dayTimer!: Phaser.Time.TimerEvent
  private debugText!: Phaser.GameObjects.Text

  private uiScene!: TradingUIScene
  private dayEnded = false

  constructor() {
    super('TradingFloorScene')
  }

  create(): void {
    gameState.phase = 'trading'
    tradingSystem.startNewDay()
    this.dayEnded = false

    const floorImg = this.textures.get('trading-floor')
    const worldW = floorImg.getSourceImage().width
    const worldH = floorImg.getSourceImage().height

    this.add.image(worldW / 2, worldH / 2, 'trading-floor')
    this.physics.world.setBounds(0, 0, worldW, worldH)

    this.cameras.main.setZoom(CAMERA_ZOOM)
    this.cameras.main.setBounds(0, 0, worldW, worldH)

    this.player = this.add.rectangle(worldW / 2, worldH / 2, 14, 18, 0x6366f1)
    ;(this.player as Phaser.GameObjects.Rectangle).setStrokeStyle(1, 0xa5b4fc)
    this.player.setDepth(50)
    this.physics.add.existing(this.player)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setCollideWorldBounds(true)
    playerBody.setSize(14, 18)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)

    this.placeNPCs()

    this.promptText = this.add
      .text(0, 0, 'Press E to trade', {
        fontSize: '8px',
        fontFamily: 'monospace',
        color: '#facc15',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(100)

    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }
    this.scene.launch('TradingUIScene')
    this.uiScene = this.scene.get('TradingUIScene') as TradingUIScene
    this.game.events.on('trading:end-day-early', this.endTradingDay, this)

    this.dayTimer = this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true,
    })

    this.interactKey.on('down', () => {
      if (this.uiScene.isDialogOpen()) return
      if (!this.nearestNPC) return

      const trader = this.npcTraders.get(this.nearestNPC)
      if (!trader || !trader.ticker) return
      this.uiScene.openTradeDialog(trader)
    })

    const cw = this.cameras.main.width
    const ch = this.cameras.main.height
    this.debugText = this.add
      .text(cw - 8, ch - 8, '', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#666666',
        align: 'right',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(9999)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('trading:end-day-early', this.endTradingDay, this)
      if (this.scene.isActive('TradingUIScene')) {
        this.scene.stop('TradingUIScene')
      }
    })
  }

  private placeNPCs(): void {
    const spriteMap: Record<string, string> = {
      vinny: 'vinny-tp',
      margaret: 'margaret-tp',
      mama: 'mama-tp',
    }

    for (const trader of TRADERS) {
      const pos = NPC_POSITIONS[trader.id]
      if (!pos) continue

      const container = this.add.container(pos.x, pos.y)
      container.setDepth(10)

      const textureKey = spriteMap[trader.id] ?? trader.id
      if (this.textures.exists(textureKey)) {
        const sprite = this.add.sprite(0, 0, textureKey)
        if (spriteMap[trader.id]) {
          sprite.setScale(0.04)
        }
        container.add(sprite)
      } else {
        const gfx = this.add.graphics()
        gfx.fillStyle(trader.color, 1)
        gfx.fillCircle(0, 0, 12)
        gfx.lineStyle(1, 0xffffff, 0.4)
        gfx.strokeCircle(0, 0, 12)
        container.add(gfx)

        const initial = this.add
          .text(0, 0, trader.nickname[0], {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#ffffff',
          })
          .setOrigin(0.5)
        container.add(initial)
      }

      const nameLabel = this.add
        .text(0, -22, trader.nickname, {
          fontSize: '6px',
          fontFamily: 'monospace',
          color: '#e2e8f0',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5)
      container.add(nameLabel)

      if (trader.ticker) {
        const tickerLabel = this.add
          .text(0, 18, trader.ticker, {
            fontSize: '6px',
            fontFamily: 'monospace',
            color: '#facc15',
            backgroundColor: '#00000088',
            padding: { x: 2, y: 1 },
          })
          .setOrigin(0.5)
        container.add(tickerLabel)
      }

      this.physics.add.existing(container)
      const body = container.body as Phaser.Physics.Arcade.Body
      body.setSize(INTERACT_DISTANCE, INTERACT_DISTANCE)
      body.setOffset(-INTERACT_DISTANCE / 2, -INTERACT_DISTANCE / 2)
      body.setImmovable(true)

      this.npcSprites.set(trader.id, container)
      this.npcTraders.set(trader.id, trader)
    }
  }

  private tickTimer(): void {
    if (this.uiScene.isDialogOpen()) return

    gameState.tradingTimeRemaining--
    this.uiScene.refreshHUD()

    if (gameState.tradingTimeRemaining <= 0) {
      this.endTradingDay()
    }
  }

  private endTradingDay(): void {
    if (this.dayEnded) return
    this.dayEnded = true

    this.dayTimer.destroy()

    if (this.uiScene.isDialogOpen()) {
      this.uiScene.closeTradeDialog()
    }
    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }

    this.scene.start('DaySummaryScene')
  }

  update(): void {
    this.updateDebug()

    const body = this.player.body as Phaser.Physics.Arcade.Body

    if (this.uiScene.isDialogOpen()) {
      body.setVelocity(0, 0)
      this.promptText.setVisible(false)
      return
    }

    let vx = 0
    let vy = 0

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -PLAYER_SPEED
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = PLAYER_SPEED

    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -PLAYER_SPEED
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = PLAYER_SPEED

    body.setVelocity(vx, vy)
    this.checkNPCProximity()
  }

  private updateDebug(): void {
    const px = Math.round(this.player.x)
    const py = Math.round(this.player.y)
    const fps = Math.round(this.game.loop.actualFps)
    const near = this.nearestNPC ?? 'none'
    const dlg = this.uiScene?.isDialogOpen() ? 'OPEN' : 'closed'
    const timer = gameState.tradingTimeRemaining
    const positions = gameState.positions.size
    const trades = gameState.todayTrades.length
    const cam = this.cameras.main
    const vw = cam.width / cam.zoom
    const vh = cam.height / cam.zoom

    this.debugText.setText(
      [
        `FPS:${fps} Canvas:${cam.width}x${cam.height} Zoom:${cam.zoom}`,
        `Viewport:${Math.round(vw)}x${Math.round(vh)}`,
        `Player:${px},${py} Near:${near}`,
        `Dialog:${dlg} Timer:${timer}s`,
        `Pos:${positions} Trades:${trades} Cap:$${gameState.capital.toFixed(0)}`,
      ].join('\n')
    )
  }

  private checkNPCProximity(): void {
    let closest: string | null = null
    let closestDist = INTERACT_DISTANCE

    const px = this.player.x
    const py = this.player.y

    for (const [id, container] of this.npcSprites) {
      const trader = this.npcTraders.get(id)
      if (!trader?.ticker) continue

      const dist = Phaser.Math.Distance.Between(px, py, container.x, container.y)
      if (dist < closestDist) {
        closestDist = dist
        closest = id
      }
    }

    if (closest !== this.nearestNPC) {
      this.nearestNPC = closest
      if (closest) {
        const container = this.npcSprites.get(closest)!
        this.promptText.setPosition(container.x, container.y + 28)
        this.promptText.setVisible(true)
      } else {
        this.promptText.setVisible(false)
      }
    }
  }
}
