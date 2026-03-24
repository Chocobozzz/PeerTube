import videojs from 'video.js'
import { VideojsPlayer, type VideojsPlugin } from '../../types'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

class VideoFlipHorizontallyPlugin extends Plugin {
  constructor(player: VideojsPlayer) {
    super(player)
    player.on('video-flip-horizontally-on', () => {
      this.player.addClass('vjs-vid-flip-h')
    })
    player.on('video-flip-horizontally-off', () => {
      this.player.removeClass(('vjs-vid-flip-h'))
    })
  }
  dispose(): void {
    this.player.removeClass('vjs-vid-flip-h')
    super.dispose()
  }
}

videojs.registerPlugin('videoFlipHorizontallyPlugin', VideoFlipHorizontallyPlugin)

export { VideoFlipHorizontallyPlugin }
