import videojs from 'video.js'
import { VideojsPlayer, type VideojsPlugin } from '../../types'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

class VideoFlipHorizontallyPlugin extends Plugin {
  constructor (player: VideojsPlayer) {
    super(player)

    player.on('video-flip-horizontally-on', () => {
      this.player.addClass('vjs-video-flip-horizontally')
    })

    player.on('video-flip-horizontally-off', () => {
      this.player.removeClass('vjs-video-flip-horizontally')
    })
  }

  enableFlip () {
    this.player.trigger('video-flip-horizontally-on')
  }

  disableFlip () {
    this.player.trigger('video-flip-horizontally-off')
  }

  toggleFlip () {
    if (this.player.hasClass('vjs-video-flip-horizontally')) {
      this.disableFlip()
    } else {
      this.enableFlip()
    }
  }

  dispose (): void {
    this.player.removeClass('vjs-video-flip-horizontally')

    super.dispose()
  }
}

videojs.registerPlugin('videoFlipHorizontallyPlugin', VideoFlipHorizontallyPlugin)

export { VideoFlipHorizontallyPlugin }
