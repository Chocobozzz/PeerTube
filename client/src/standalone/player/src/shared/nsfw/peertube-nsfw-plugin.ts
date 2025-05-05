import videojs from 'video.js'
import { PeerTubeNSFWComponent } from './peertube-nsfw-component'

const Plugin = videojs.getPlugin('plugin')

export type PeerTubeNSFWPluginOptions = {
  summary: string
  flags: number
}

class PeerTubeNSFWPlugin extends Plugin {
  declare private nsfwComponent: PeerTubeNSFWComponent

  constructor (player: videojs.Player, options: videojs.PlayerOptions & PeerTubeNSFWPluginOptions) {
    super(player, options)

    player.ready(() => {
      player.addClass('peertube-nsfw')

      this.nsfwComponent = new PeerTubeNSFWComponent(player, options)
      player.addChild(this.nsfwComponent)
    })

    player.one('play', () => {
      this.nsfwComponent.hide()
    })
  }

  dispose () {
    this.nsfwComponent?.dispose()
    this.player.removeChild(this.nsfwComponent)
    this.player.removeClass('peertube-nsfw')

    super.dispose()
  }
}

videojs.registerPlugin('peertubeNSFW', PeerTubeNSFWPlugin)

export { PeerTubeNSFWPlugin }
