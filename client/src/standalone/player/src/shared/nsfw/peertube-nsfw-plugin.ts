import videojs from 'video.js'
import { PeerTubeNSFWInfoComponent } from './peertube-nsfw-info-component'
import { PeerTubeNSFWDetailsComponent } from './peertube-nsfw-details-component'

const Plugin = videojs.getPlugin('plugin')

export type PeerTubeNSFWPluginOptions = {
  summary: string
  flags: number
}

class PeerTubeNSFWPlugin extends Plugin {
  declare private nsfwInfoComponent: PeerTubeNSFWInfoComponent
  declare private nsfwDetailsComponent: PeerTubeNSFWDetailsComponent

  constructor (player: videojs.Player, options: videojs.PlayerOptions & PeerTubeNSFWPluginOptions) {
    super(player, options)

    player.ready(() => {
      player.addClass('peertube-nsfw')

      this.nsfwInfoComponent = new PeerTubeNSFWInfoComponent(player, options)
      player.addChild(this.nsfwInfoComponent)

      this.nsfwDetailsComponent = new PeerTubeNSFWDetailsComponent(player, options)
      this.nsfwDetailsComponent.hide()
      player.addChild(this.nsfwDetailsComponent)

      this.nsfwInfoComponent.on('showDetails', () => {
        this.nsfwDetailsComponent.show()
        this.nsfwInfoComponent.hide()
      })

      this.nsfwDetailsComponent.on('hideDetails', () => {
        this.nsfwInfoComponent.show()
        this.nsfwDetailsComponent.hide()
      })
    })

    player.one('play', () => {
      this.nsfwInfoComponent.hide()
    })
  }

  dispose () {
    this.nsfwInfoComponent?.dispose()
    this.player.removeChild(this.nsfwInfoComponent)
    this.player.removeChild(this.nsfwDetailsComponent)
    this.player.removeClass('peertube-nsfw')

    super.dispose()
  }
}

videojs.registerPlugin('peertubeNSFW', PeerTubeNSFWPlugin)

export { PeerTubeNSFWPlugin }
