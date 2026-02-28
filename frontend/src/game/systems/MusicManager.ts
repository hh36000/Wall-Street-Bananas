import Phaser from 'phaser'

/**
 * Play a music track on a simple infinite loop.
 * Returns the sound instance — call .stop() to end it.
 */
export function playLoopedMusic(
  scene: Phaser.Scene,
  key: string,
  volume = 0.5
): Phaser.Sound.WebAudioSound {
  const music = scene.sound.add(key, {
    loop: true,
    volume,
  }) as Phaser.Sound.WebAudioSound

  music.play()
  return music
}
