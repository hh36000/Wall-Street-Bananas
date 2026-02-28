import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Phaser from 'phaser'
import Layout from '@/components/Layout'
import { getSidebarSections } from '@/config/sidebar'

// --- Phaser Scenes ---

class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private bananas!: Phaser.Physics.Arcade.Group
  private bombs!: Phaser.Physics.Arcade.Group
  private scoreText!: Phaser.GameObjects.Text
  private livesText!: Phaser.GameObjects.Text
  private score = 0
  private lives = 3
  private spawnTimer!: Phaser.Time.TimerEvent
  private bombTimer!: Phaser.Time.TimerEvent
  private gameOver = false
  private restartKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super('GameScene')
  }

  create() {
    this.score = 0
    this.lives = 3
    this.gameOver = false

    const { width, height } = this.scale

    // Background gradient
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    bg.fillRect(0, 0, width, height)

    // Ground
    const ground = this.add.rectangle(width / 2, height - 15, width, 30, 0x2d2d44)
    this.physics.add.existing(ground, true)

    // Decorative grid lines
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x2a2a4a, 0.3)
    for (let x = 0; x < width; x += 40) {
      grid.lineBetween(x, 0, x, height)
    }
    for (let y = 0; y < height; y += 40) {
      grid.lineBetween(0, y, width, y)
    }

    // Player (basket)
    this.player = this.add.rectangle(width / 2, height - 50, 80, 24, 0x6366f1)
    this.player.setStrokeStyle(2, 0x818cf8)
    this.physics.add.existing(this.player)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setCollideWorldBounds(true)
    playerBody.setImmovable(true)

    // Banana group
    this.bananas = this.physics.add.group()

    // Bomb group
    this.bombs = this.physics.add.group()

    // Collisions
    this.physics.add.overlap(this.player, this.bananas, this.collectBanana, undefined, this)
    this.physics.add.overlap(this.player, this.bombs, this.hitBomb, undefined, this)
    this.physics.add.collider(this.bananas, ground, this.missedBanana as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this)
    this.physics.add.collider(this.bombs, ground, this.removeBomb as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this)

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.restartKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)

    // HUD
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#c3c3cc',
    })

    this.livesText = this.add.text(width - 16, 16, 'Lives: 3', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#c3c3cc',
    }).setOrigin(1, 0)

    // Spawn timers
    this.spawnTimer = this.time.addEvent({
      delay: 800,
      callback: this.spawnBanana,
      callbackScope: this,
      loop: true,
    })

    this.bombTimer = this.time.addEvent({
      delay: 2500,
      callback: this.spawnBomb,
      callbackScope: this,
      loop: true,
    })

    // Title flash
    const title = this.add.text(width / 2, height / 2 - 40, 'Catch the Bananas!', {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#facc15',
    }).setOrigin(0.5)

    const subtitle = this.add.text(width / 2, height / 2, 'Arrow keys to move', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#818cf8',
    }).setOrigin(0.5)

    this.tweens.add({
      targets: [title, subtitle],
      alpha: 0,
      delay: 1500,
      duration: 500,
    })
  }

  update() {
    if (this.gameOver) {
      if (this.restartKey.isDown) {
        this.scene.restart()
      }
      return
    }

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setVelocityX(0)

    if (this.cursors.left.isDown) {
      playerBody.setVelocityX(-400)
    } else if (this.cursors.right.isDown) {
      playerBody.setVelocityX(400)
    }
  }

  private spawnBanana() {
    if (this.gameOver) return
    const x = Phaser.Math.Between(30, this.scale.width - 30)

    // Draw banana shape
    const banana = this.add.graphics()
    banana.fillStyle(0xfacc15)
    banana.fillEllipse(0, 0, 20, 12)
    banana.fillStyle(0xeab308)
    banana.fillEllipse(0, -2, 14, 6)

    this.physics.add.existing(banana)
    this.bananas.add(banana)

    banana.setPosition(x, -10)
    const body = banana.body as Phaser.Physics.Arcade.Body
    body.setSize(20, 12)
    body.setOffset(-10, -6)
    const speed = Phaser.Math.Between(120, 200 + this.score * 2)
    body.setVelocityY(speed)
  }

  private spawnBomb() {
    if (this.gameOver) return
    const x = Phaser.Math.Between(30, this.scale.width - 30)

    const bomb = this.add.graphics()
    bomb.fillStyle(0xef4444)
    bomb.fillCircle(0, 0, 10)
    bomb.fillStyle(0xfca5a5)
    bomb.fillCircle(-3, -3, 3)

    this.physics.add.existing(bomb)
    this.bombs.add(bomb)

    bomb.setPosition(x, -10)
    const body = bomb.body as Phaser.Physics.Arcade.Body
    body.setSize(20, 20)
    body.setOffset(-10, -10)
    body.setVelocityY(Phaser.Math.Between(150, 250))
  }

  private collectBanana(_player: Phaser.GameObjects.GameObject, banana: Phaser.GameObjects.GameObject) {
    banana.destroy()
    this.score += 10
    this.scoreText.setText(`Score: ${this.score}`)

    // Flash effect
    this.cameras.main.flash(100, 250, 204, 21, true)

    // Speed up spawning as score increases
    if (this.score % 50 === 0 && this.spawnTimer.delay > 300) {
      this.spawnTimer.delay -= 50
    }
  }

  private hitBomb(_player: Phaser.GameObjects.GameObject, bomb: Phaser.GameObjects.GameObject) {
    bomb.destroy()
    this.lives--
    this.livesText.setText(`Lives: ${this.lives}`)

    // Screen shake
    this.cameras.main.shake(200, 0.01)
    this.player.fillColor = 0xef4444

    this.time.delayedCall(200, () => {
      if (!this.gameOver) {
        this.player.fillColor = 0x6366f1
      }
    })

    if (this.lives <= 0) {
      this.endGame()
    }
  }

  private missedBanana(_banana: Phaser.GameObjects.GameObject) {
    _banana.destroy()
  }

  private removeBomb(_bomb: Phaser.GameObjects.GameObject) {
    _bomb.destroy()
  }

  private endGame() {
    this.gameOver = true
    this.spawnTimer.destroy()
    this.bombTimer.destroy()
    this.player.fillColor = 0x4b5563

    const { width, height } = this.scale

    // Darken overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
    overlay.setAlpha(0)
    this.tweens.add({ targets: overlay, alpha: 1, duration: 300 })

    const gameOverText = this.add.text(width / 2, height / 2 - 30, 'GAME OVER', {
      fontSize: '40px',
      fontFamily: 'monospace',
      color: '#ef4444',
    }).setOrigin(0.5).setAlpha(0)

    const finalScore = this.add.text(width / 2, height / 2 + 20, `Final Score: ${this.score}`, {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#facc15',
    }).setOrigin(0.5).setAlpha(0)

    const restart = this.add.text(width / 2, height / 2 + 60, 'Press R to restart', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#818cf8',
    }).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: [gameOverText, finalScore, restart],
      alpha: 1,
      duration: 500,
      delay: 300,
    })
  }
}

// --- React Component ---

function Game() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const sidebarSections = getSidebarSections(location.pathname)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 500,
      parent: containerRef.current,
      backgroundColor: '#1a1a2e',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [GameScene],
    }

    gameRef.current = new Phaser.Game(config)

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <Layout
      sidebarProps={{ sections: sidebarSections }}
      navbarProps={{
        user: { name: 'User', avatar: 'https://github.com/shadcn.png' },
        searchPlaceholder: 'Search...',
      }}
    >
      <div className="py-8 px-4 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        <header className="mb-8">
          <h1 className="text-4xl font-semibold text-foreground mb-2">
            Banana Catcher
          </h1>
          <p className="text-muted-foreground">
            Catch the falling bananas and avoid the bombs. Use arrow keys to move.
          </p>
        </header>

        <div className="bg-card text-card-foreground rounded-lg shadow-lg p-6">
          <div
            ref={containerRef}
            className="w-full flex justify-center rounded overflow-hidden"
          />
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Arrow Keys: Move | R: Restart</span>
            <span>Powered by Phaser 3</span>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Game
