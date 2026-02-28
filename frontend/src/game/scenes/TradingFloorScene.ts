import Phaser from 'phaser'
import { gameState } from '../GameState'
import { tradingSystem } from '../systems/TradingSystem'
import { TRADERS, getTraderByTicker } from '../data/traders'
import type { TraderDef } from '../types'
import { TradingUIScene } from './TradingUIScene'

// NPC positions on the trading floor (1408x768)
// Clustered around the pit and on the open floor, away from edge desks
const NPC_POSITIONS: Record<string, { x: number; y: number }> = {
  // Upper floor (between top wall and pit)
  vinny: { x: 300, y: 240 },
  margaret: { x: 480, y: 220 },
  bigal: { x: 680, y: 230 },
  professor: { x: 880, y: 220 },
  donna: { x: 1080, y: 250 },

  // Left side of pit
  quietmike: { x: 280, y: 380 },
  tommy: { x: 400, y: 330 },
  paulie: { x: 310, y: 510 },

  // Right side of pit
  mama: { x: 1000, y: 300 },
  sal: { x: 1120, y: 380 },
  eddie: { x: 1050, y: 450 },

  // Around the pit walkway
  frank: { x: 700, y: 310 },
  santos: { x: 580, y: 410 },
  ricky: { x: 830, y: 390 },
  nancy: { x: 720, y: 470 },

  // Mid floor
  whitey: { x: 400, y: 460 },
  tony: { x: 530, y: 530 },
  bernie: { x: 920, y: 530 },
  charlie: { x: 1080, y: 540 },

  // Lower floor (above bottom desks)
  diane: { x: 310, y: 600 },
  bobby: { x: 460, y: 620 },
  tina: { x: 640, y: 610 },
  jerome: { x: 820, y: 620 },
  gus: { x: 980, y: 610 },
  maddog: { x: 1130, y: 590 },
}

const PLAYER_SPEED = 200
const CAMERA_ZOOM = 1
const INTERACT_DISTANCE = 50

export class TradingFloorScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite
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
  private countdownActive = true
  private tradingMusic!: Phaser.Sound.BaseSound

  // Ticker search
  private tickerSearchInput: HTMLInputElement | null = null
  private tickerSearchOverlay: Phaser.GameObjects.Container | null = null
  private tickerSearchKeyHandler: ((e: KeyboardEvent) => void) | null = null

  // NPC labels + weakness toggle
  private npcLabels: Map<string, Phaser.GameObjects.Text> = new Map()
  private showingWeaknesses = false

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

    this.player = this.add.sprite(worldW / 2, worldH / 2, 'player-tp')
    this.player.setScale(0.08)
    this.player.setDepth(50)
    this.physics.add.existing(this.player)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setCollideWorldBounds(true)
    playerBody.setSize(this.player.width * 0.6, this.player.height * 0.5)
    playerBody.setOffset(this.player.width * 0.2, this.player.height * 0.4)

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
    this.uiScene = this.scene.get('TradingUIScene') as TradingUIScene
    this.game.events.on('trading:end-day-early', this.endTradingDay, this)

    this.interactKey.on('down', () => {
      if (this.countdownActive) return
      if (this.uiScene.isDialogOpen()) return
      if (!this.nearestNPC) return

      const trader = this.npcTraders.get(this.nearestNPC)
      if (!trader || !trader.ticker) return
      this.uiScene.openTradeDialog(trader)
    })

    // ─── Countdown ───
    this.countdownActive = true
    this.runCountdown()

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

    // Cmd+F ticker search
    this.tickerSearchKeyHandler = (e: KeyboardEvent) => {
      if (this.countdownActive) return
      if ((e.key === 'f' || e.key === 'F') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (this.uiScene.isDialogOpen()) return
        this.openTickerSearch()
      }
      if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        this.endTradingDay()
      }
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        this.toggleWeaknessLabels()
      }
    }
    window.addEventListener('keydown', this.tickerSearchKeyHandler)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('trading:end-day-early', this.endTradingDay, this)
      this.closeTickerSearch()
      if (this.tradingMusic?.isPlaying) {
        this.tradingMusic.stop()
      }
      if (this.tickerSearchKeyHandler) {
        window.removeEventListener('keydown', this.tickerSearchKeyHandler)
        this.tickerSearchKeyHandler = null
      }
      if (this.scene.isActive('TradingUIScene')) {
        this.scene.stop('TradingUIScene')
      }
    })
  }

  private playBeep(freq: number, duration: number): void {
    const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.value = 0.15
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }

  private runCountdown(): void {
    const { width, height } = this.scale
    const cam = this.cameras.main

    // Full-screen overlay fixed to camera
    const overlay = this.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x000000, 0.75)
    overlay.setScrollFactor(0).setDepth(9000)

    const countText = this.add
      .text(cam.width / 2, cam.height / 2, '5', {
        fontSize: '160px',
        fontFamily: '"Press Start 2P"',
        color: '#facc15',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9001)

    const subtitleText = this.add
      .text(cam.width / 2, cam.height / 2 + 110, 'MARKET OPENS IN...', {
        fontSize: '18px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9001)

    let remaining = 5

    // Initial beep
    this.playBeep(440, 0.2)

    const ticker = this.time.addEvent({
      delay: 1000,
      callback: () => {
        remaining--
        if (remaining > 0) {
          countText.setText(`${remaining}`)
          // Scale pop animation
          countText.setScale(1.3)
          this.tweens.add({ targets: countText, scale: 1, duration: 300, ease: 'Back.easeOut' })
          this.playBeep(440, 0.2)
        } else {
          // GO!
          countText.setText('GO!')
          countText.setColor('#4ade80')
          countText.setFontSize(120)
          countText.setScale(1.5)
          this.tweens.add({ targets: countText, scale: 1, duration: 300, ease: 'Back.easeOut' })
          subtitleText.setText('MARKET IS OPEN')
          subtitleText.setColor('#4ade80')
          this.playBeep(880, 0.4)

          ticker.destroy()

          // Fade out overlay after a beat
          this.time.delayedCall(600, () => {
            this.tweens.add({
              targets: [overlay, countText, subtitleText],
              alpha: 0,
              duration: 400,
              onComplete: () => {
                overlay.destroy()
                countText.destroy()
                subtitleText.destroy()

                // Now start trading
                this.countdownActive = false
                this.scene.launch('TradingUIScene')

                this.dayTimer = this.time.addEvent({
                  delay: 1000,
                  callback: this.tickTimer,
                  callbackScope: this,
                  loop: true,
                })

                // Start trading music
                this.tradingMusic = this.sound.add('music-trading', { loop: true, volume: 0.5 })
                this.tradingMusic.play()
              },
            })
          })
        }
      },
      callbackScope: this,
      loop: true,
    })
  }

  private placeNPCs(): void {
    // Map trader ids to their texture keys (only needed where filename differs from id)
    const spriteMap: Record<string, string> = {
      vinny: 'vinny-tp',
      margaret: 'margaret-tp',
      mama: 'mama-tp',
    }

    // Per-sprite scale + content top offset (pixels from image center to top of visible art)
    const spriteInfo: Record<string, { scale: number; topOff: number }> = {
      vinny:     { scale: 0.085, topOff: -399 },
      margaret:  { scale: 0.097, topOff: -308 },
      bigal:     { scale: 0.069, topOff: -398 },
      professor: { scale: 0.078, topOff: -359 },
      donna:     { scale: 0.080, topOff: -378 },
      quietmike: { scale: 0.072, topOff: -512 },
      tommy:     { scale: 0.085, topOff: -339 },
      santos:    { scale: 0.077, topOff: -375 },
      ricky:     { scale: 0.100, topOff: -266 },
      eddie:     { scale: 0.105, topOff: -266 },
      sal:       { scale: 0.081, topOff: -337 },
      paulie:    { scale: 0.150, topOff: -170 },
      tony:      { scale: 0.080, topOff: -349 },
      nancy:     { scale: 0.127, topOff: -259 },
      bernie:    { scale: 0.072, topOff: -378 },
      charlie:   { scale: 0.150, topOff: -113 },
      diane:     { scale: 0.073, topOff: -378 },
      bobby:     { scale: 0.130, topOff: -225 },
      tina:      { scale: 0.101, topOff: -285 },
      jerome:    { scale: 0.108, topOff: -317 },
      gus:       { scale: 0.105, topOff: -247 },
      maddog:    { scale: 0.078, topOff: -419 },
      whitey:    { scale: 0.094, topOff: -349 },
      mama:      { scale: 0.074, topOff: -370 },
      frank:     { scale: 0.079, topOff: -337 },
    }

    for (const trader of TRADERS) {
      const pos = NPC_POSITIONS[trader.id]
      if (!pos) continue

      const container = this.add.container(pos.x, pos.y)
      container.setDepth(10)

      const textureKey = spriteMap[trader.id] ?? trader.id
      const info = spriteInfo[trader.id] ?? { scale: 0.08, topOff: -350 }
      const sprite = this.add.sprite(0, 0, textureKey)
      sprite.setScale(info.scale)
      container.add(sprite)

      // Position label just above the visible top of the character art
      const labelY = info.topOff * info.scale - 4

      const labelText = trader.ticker
        ? `${trader.nickname}\n${trader.ticker}`
        : trader.nickname
      const label = this.add
        .text(0, labelY, labelText, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#facc15',
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 },
          align: 'center',
        })
        .setOrigin(0.5, 1)
      container.add(label)
      this.npcLabels.set(trader.id, label)

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

    this.dayTimer?.destroy()

    // Stop trading music
    if (this.tradingMusic?.isPlaying) {
      this.tradingMusic.stop()
    }

    if (this.uiScene.isDialogOpen()) {
      this.uiScene.closeTradeDialog()
    }
    if (this.scene.isActive('TradingUIScene')) {
      this.scene.stop('TradingUIScene')
    }

    this.scene.start('DaySummaryScene')
  }

  private openTickerSearch(): void {
    if (this.tickerSearchInput) return

    // Phaser overlay: backdrop + label
    const cw = this.cameras.main.width
    const ch = this.cameras.main.height
    this.tickerSearchOverlay = this.add.container(0, 0).setDepth(10000).setScrollFactor(0)

    const backdrop = this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.5)
    this.tickerSearchOverlay.add(backdrop)

    const label = this.add
      .text(cw / 2, ch / 2 - 50, 'FIND TRADER BY TICKER', {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#facc15',
      })
      .setOrigin(0.5)
    this.tickerSearchOverlay.add(label)

    const hint = this.add
      .text(cw / 2, ch / 2 + 40, 'Enter a ticker symbol (e.g. IBM, XOM, GE) and press Enter', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
    this.tickerSearchOverlay.add(hint)

    const errorText = this.add
      .text(cw / 2, ch / 2 + 65, '', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#f87171',
      })
      .setOrigin(0.5)
    this.tickerSearchOverlay.add(errorText)

    // DOM input
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'TICKER...'
    input.style.cssText = `
      position: fixed;
      font-family: monospace;
      font-size: 22px;
      color: #facc15;
      background: #1a1a2e;
      border: 2px solid #facc15;
      border-radius: 4px;
      padding: 8px 16px;
      outline: none;
      box-sizing: border-box;
      text-align: center;
      text-transform: uppercase;
      z-index: 1000;
      letter-spacing: 2px;
    `

    // Position centered on screen
    const canvas = this.game.canvas
    const canvasRect = canvas.getBoundingClientRect()
    const scaleX = canvasRect.width / this.scale.width
    const scaleY = canvasRect.height / this.scale.height
    const inputW = 200
    const inputH = 44
    const gameX = (this.scale.width - inputW) / 2
    const gameY = this.scale.height / 2 - inputH / 2

    input.style.left = `${canvasRect.left + gameX * scaleX}px`
    input.style.top = `${canvasRect.top + gameY * scaleY}px`
    input.style.width = `${inputW * scaleX}px`
    input.style.height = `${inputH * scaleY}px`

    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        const ticker = input.value.trim().toUpperCase()
        if (!ticker) return
        const trader = getTraderByTicker(ticker)
        if (trader) {
          this.closeTickerSearch()
          this.uiScene.openTradeDialog(trader)
        } else {
          errorText.setText(`No trader found for "${ticker}"`)
        }
      }
      if (e.key === 'Escape') {
        this.closeTickerSearch()
      }
    })

    document.body.appendChild(input)
    this.tickerSearchInput = input
    input.focus()
  }

  private toggleWeaknessLabels(): void {
    this.showingWeaknesses = !this.showingWeaknesses
    for (const [id, label] of this.npcLabels) {
      const trader = this.npcTraders.get(id)
      if (!trader) continue
      if (this.showingWeaknesses) {
        label.setText(trader.weakness)
        label.setColor('#c084fc')
      } else {
        const text = trader.ticker
          ? `${trader.nickname}\n${trader.ticker}`
          : trader.nickname
        label.setText(text)
        label.setColor('#facc15')
      }
    }
  }

  private closeTickerSearch(): void {
    if (this.tickerSearchInput) {
      this.tickerSearchInput.remove()
      this.tickerSearchInput = null
    }
    if (this.tickerSearchOverlay) {
      this.tickerSearchOverlay.destroy()
      this.tickerSearchOverlay = null
    }
  }

  update(): void {
    this.updateDebug()

    const body = this.player.body as Phaser.Physics.Arcade.Body

    if (this.countdownActive) {
      body.setVelocity(0, 0)
      this.promptText.setVisible(false)
      return
    }

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
        `Pos:${positions} Trades:${trades} PnL:$${gameState.cumulativePnl.toFixed(0)}`,
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
