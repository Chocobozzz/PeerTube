import videojs from 'video.js'
import { buildVideoLink, decorateVideoLink } from '@shared/core-utils'
import { PeerTubeLinkButtonOptions } from '../../types'

const Component = videojs.getComponent('Component')
class PeerTubeLinkButton extends Component {

  constructor (player: videojs.Player, options?: PeerTubeLinkButtonOptions) {
    super(player, options as any)
  }

  createEl () {
    return this.buildElement()
  }

  updateHref () {
    this.el().setAttribute('href', this.buildLink())
  }

  private buildElement () {
    const el = videojs.dom.createEl('a', {
      href: this.buildLink(),
      innerHTML: (this.options_ as PeerTubeLinkButtonOptions).instanceName,
      title: this.player().localize('Video page (new window)'),
      className: 'vjs-peertube-link',
      target: '_blank'
    })

    el.addEventListener('mouseenter', () => this.updateHref())
    el.addEventListener('click', () => this.player().pause())

    return el as HTMLButtonElement
  }

  private buildLink () {
    const url = buildVideoLink({ shortUUID: (this.options_ as PeerTubeLinkButtonOptions).shortUUID })

    return decorateVideoLink({ url, startTime: this.player().currentTime() })
  }
}

videojs.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)
