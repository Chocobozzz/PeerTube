import videojs from 'video.js'
import { PeerTubeLinkButtonOptions } from '../peertube-videojs-typings'
import { buildVideoLink, decorateVideoLink } from '../utils'

const Button = videojs.getComponent('Button')
class PeerTubeLinkButton extends Button {
  private shortUUID: string

  constructor (player: videojs.Player, options?: PeerTubeLinkButtonOptions) {
    super(player, options as any)
  }

  createEl () {
    return this.buildElement()
  }

  updateHref () {
    this.el().setAttribute('href', this.buildLink())
  }

  handleClick () {
    this.player().pause()
  }

  private buildElement () {
    const el = videojs.dom.createEl('a', {
      href: this.buildLink(),
      innerHTML: 'PeerTube',
      title: this.player().localize('Video page (new window)'),
      className: 'vjs-peertube-link',
      target: '_blank'
    })

    el.addEventListener('mouseenter', () => this.updateHref())

    return el as HTMLButtonElement
  }

  private buildLink () {
    const url = buildVideoLink({ shortUUID: this.shortUUID })

    return decorateVideoLink({ url, startTime: this.player().currentTime() })
  }
}

videojs.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)
