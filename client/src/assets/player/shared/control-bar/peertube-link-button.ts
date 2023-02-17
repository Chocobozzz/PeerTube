import videojs from 'video.js'
import { buildVideoLink, decorateVideoLink } from '@shared/core-utils'
import { PeerTubeLinkButtonOptions } from '../../types'

const Button = videojs.getComponent('Button')
class PeerTubeLinkButton extends Button {

  ael : HTMLButtonElement | null

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

  dispose() {

    if(this.ael)
      this.ael.removeEventListener('mouseenter', this.updateHref)
    this.ael  = null
  }

  private buildElement () {
    const el = videojs.dom.createEl('a', {
      href: this.buildLink(),
      innerHTML: 'Peertube',
      title: this.player().localize('Video page (new window)'),
      className: 'vjs-peertube-link',
      target: '_blank'
    })

    el.addEventListener('mouseenter', this.updateHref)

    this.ael = el as HTMLButtonElement

    return el as HTMLButtonElement
  }

  private buildLink () {
    const url = buildVideoLink({ shortUUID: (this.options_ as PeerTubeLinkButtonOptions).shortUUID })

    return decorateVideoLink({ url, startTime: this.player().currentTime() })
  }
}

videojs.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)
