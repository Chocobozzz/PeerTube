import { VideoCommercialContent, VideoCommercialContentType } from '@peertube/peertube-models'
import videojs from 'video.js'
import { VideojsPlayer, VideojsPlugin } from '../../types'
import { getPlayerTopBar } from '../top-bar/peertube-top-bar-component'
import { PeerTubeCommercialContentInfoComponent } from './peertube-commercial-content-info-component'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

const INFO_DISPLAY_DURATION = 10

export type PeerTubeCommercialContentPluginOptions = {
  commercialContent: VideoCommercialContentType
}

function getCommercialContentPlayerLabel (player: VideojsPlayer, commercialContent: VideoCommercialContentType) {
  switch (commercialContent) {
    case VideoCommercialContent.PROMOTIONAL:
      return player.localize('Includes promotional content')

    case VideoCommercialContent.PAID_PARTNERSHIP:
      return player.localize('Includes paid partnership')

    default:
      return undefined
  }
}

class PeerTubeCommercialContentPlugin extends Plugin {
  declare private infoComponent: PeerTubeCommercialContentInfoComponent

  private playbackStart: number

  private readonly onPlaying = () => {
    this.playbackStart = this.player.currentTime()
    this.infoComponent?.show()

    this.player.on('timeupdate', this.onTimeUpdate)
  }

  private readonly onTimeUpdate = () => {
    if (Math.abs(this.player.currentTime() - this.playbackStart) < INFO_DISPLAY_DURATION) return

    this.infoComponent?.hide()
    this.player.off('timeupdate', this.onTimeUpdate)
  }

  constructor (player: VideojsPlayer, options: PeerTubeCommercialContentPluginOptions) {
    super(player)

    const label = getCommercialContentPlayerLabel(player, options.commercialContent)
    if (!label) return

    player.ready(() => {
      this.infoComponent = new PeerTubeCommercialContentInfoComponent(player, { label })
      this.infoComponent.hide()
      player.addChild(this.infoComponent)
      getPlayerTopBar(player).addItem(this.infoComponent)
    })

    player.one('playing', this.onPlaying)
  }

  dispose () {
    this.player.off('playing', this.onPlaying)
    this.player.off('timeupdate', this.onTimeUpdate)

    if (this.infoComponent) {
      this.infoComponent.dispose()
      this.player.removeChild(this.infoComponent)
    }

    super.dispose()
  }
}

videojs.registerPlugin('peertubeCommercialContent', PeerTubeCommercialContentPlugin)

export { PeerTubeCommercialContentPlugin }
