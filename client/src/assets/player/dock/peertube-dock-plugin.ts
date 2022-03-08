import videojs from 'video.js'
import { PeerTubeDockComponent } from './peertube-dock-component'

const Plugin = videojs.getPlugin('plugin')

export type PeerTubeDockPluginOptions = {
  title?: string
  description?: string
  avatarUrl?: string
}

class PeerTubeDockPlugin extends Plugin {
  constructor (player: videojs.Player, options: videojs.PlayerOptions & PeerTubeDockPluginOptions) {
    super(player, options)

    this.player.addClass('peertube-dock')

    this.player.ready(() => {
      this.player.addChild('PeerTubeDockComponent', options) as PeerTubeDockComponent
    })
  }
}

videojs.registerPlugin('peertubeDock', PeerTubeDockPlugin)
export { PeerTubeDockPlugin }
