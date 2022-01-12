import './peertube-mobile-buttons'
import videojs from 'video.js'

const Plugin = videojs.getPlugin('plugin')

class PeerTubeMobilePlugin extends Plugin {

  constructor (player: videojs.Player, options: videojs.PlayerOptions) {
    super(player, options)

    player.addChild('PeerTubeMobileButtons')

    if (videojs.browser.IS_ANDROID && screen.orientation) {
      this.handleFullscreenRotation()
    }
  }

  private handleFullscreenRotation () {
    this.player.on('fullscreenchange', () => {
      if (!this.player.isFullscreen() || this.isPortraitVideo()) return

      screen.orientation.lock('landscape')
        .catch(err => console.error('Cannot lock screen to landscape.', err))
    })
  }

  private isPortraitVideo () {
    return this.player.videoWidth() < this.player.videoHeight()
  }
}

videojs.registerPlugin('peertubeMobile', PeerTubeMobilePlugin)
export { PeerTubeMobilePlugin }
