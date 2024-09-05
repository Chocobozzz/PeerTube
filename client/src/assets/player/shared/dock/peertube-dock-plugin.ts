import videojs from 'video.js'
import { PeerTubeDockComponent } from './peertube-dock-component'

const Plugin = videojs.getPlugin('plugin')

export type PeerTubeDockPluginOptions = {
  title?: string
  description?: string
  avatarUrl?: string
}

class PeerTubeDockPlugin extends Plugin {
  declare private dockComponent: PeerTubeDockComponent

  constructor (player: videojs.Player, options: videojs.PlayerOptions & PeerTubeDockPluginOptions) {
    super(player, options)

    player.ready(() => {
      player.addClass('peertube-dock')
    })

    this.dockComponent = new PeerTubeDockComponent(player, options)
    player.addChild(this.dockComponent)
  }

  dispose () {
    this.dockComponent?.dispose()
    this.player.removeChild(this.dockComponent)
    this.player.removeClass('peertube-dock')

    super.dispose()
  }
}

videojs.registerPlugin('peertubeDock', PeerTubeDockPlugin)
export { PeerTubeDockPlugin }
