import Phaser from 'phaser'

const FADE_MS = 2000
const LOOP_FROM = 27 // seconds

/**
 * Play a music track that loops from LOOP_FROM seconds with a
 * crossfade (fade-out near end, fade-in on restart).
 * Returns the sound instance — call .stop() to end it.
 */
export function playLoopedMusic(
  scene: Phaser.Scene,
  key: string,
  volume = 0.5
): Phaser.Sound.WebAudioSound {
  const music = scene.sound.add(key, {
    loop: false,
    volume,
  }) as Phaser.Sound.WebAudioSound

  let fadeOutTimer: Phaser.Time.TimerEvent | null = null

  const scheduleFadeOut = (seekStart: number) => {
    // Wait a tick so .duration is populated
    scene.time.delayedCall(100, () => {
      const dur = music.duration
      if (dur <= 0) return

      const playMs = (dur - seekStart) * 1000
      const fadeStart = playMs - FADE_MS

      if (fadeStart > 0) {
        fadeOutTimer = scene.time.delayedCall(fadeStart, () => {
          scene.tweens.add({
            targets: music,
            volume: 0,
            duration: FADE_MS,
          })
        })
      }
    })
  }

  music.on('complete', () => {
    // Restart from loop point with fade in
    music.play({ seek: LOOP_FROM })
    music.setVolume(0)
    scene.tweens.add({
      targets: music,
      volume,
      duration: FADE_MS,
    })
    scheduleFadeOut(LOOP_FROM)
  })

  // First play from the top
  music.play()
  scheduleFadeOut(0)

  return music
}
