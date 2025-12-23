import videojs from 'video.js'
import { VideojsPlayer, VideojsPlugin } from '../../types'
import { PeerTubeDockComponent } from './peertube-dock-component'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

export type PeerTubeDockPluginOptions = {
  title?: string
  description?: string
  avatarUrl?: string
}

class PeerTubeDockPlugin extends Plugin {
  declare private dockComponent: PeerTubeDockComponent

  constructor (player: VideojsPlayer, options: PeerTubeDockPluginOptions) {
    super(player)

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
