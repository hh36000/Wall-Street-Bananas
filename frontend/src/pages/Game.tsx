import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BootScene } from '@/game/scenes/BootScene'
import { MorningScene } from '@/game/scenes/MorningScene'
import { TradingFloorScene } from '@/game/scenes/TradingFloorScene'
import { TradingUIScene } from '@/game/scenes/TradingUIScene'
import { DaySummaryScene } from '@/game/scenes/DaySummaryScene'

function Game() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      parent: containerRef.current,
      backgroundColor: '#0a0a1a',
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
      scene: [BootScene, MorningScene, TradingFloorScene, TradingUIScene, DaySummaryScene],
    }

    gameRef.current = new Phaser.Game(config)

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0a0a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default Game
