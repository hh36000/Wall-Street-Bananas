import Phaser from 'phaser'

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene')
  }

  create(): void {
    const { width, height } = this.scale

    // Black background
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000)

    // Video background — looping, cover-fit (no stretching)
    const vid = this.add.video(width / 2, height / 2, 'home-video')
    vid.play(true)

    // Wait for video to have dimensions, then scale to cover
    vid.once('play', () => {
      const vw = vid.video!.videoWidth
      const vh = vid.video!.videoHeight
      const scale = Math.max(width / vw, height / vh)
      vid.setDisplaySize(vw * scale, vh * scale)
    })

    // Morning music loop
    this.sound.play('music-morning', { loop: true })

    // Blinking "PRESS ENTER TO BEGIN" text at the bottom
    const prompt = this.add
      .text(width / 2, height - 80, 'PRESS ENTER TO BEGIN', {
        fontSize: '36px',
        fontFamily: '"Press Start 2P"',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    this.tweens.add({
      targets: prompt,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    })

    // Listen for Enter key
    this.input.keyboard!.on('keydown-ENTER', () => {
      vid.stop()
      this.scene.start('PlayerSetupScene')
    })
  }
}
