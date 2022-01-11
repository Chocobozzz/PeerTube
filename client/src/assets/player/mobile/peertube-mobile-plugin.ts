import videojs from 'video.js'
import './peertube-mobile-buttons'

const Plugin = videojs.getPlugin('plugin')

class PeerTubeMobilePlugin extends Plugin {

  constructor (player: videojs.Player, options: videojs.PlayerOptions) {
    super(player, options)

    player.addChild('PeerTubeMobileButtons')
  }
}

videojs.registerPlugin('peertubeMobile', PeerTubeMobilePlugin)
export { PeerTubeMobilePlugin }
