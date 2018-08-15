import * as videojs from 'video.js'
import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { buildVideoLink } from './utils'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
class PeerTubeLinkButton extends Button {

  constructor (player: videojs.Player, options) {
    super(player, options)
  }

  createEl () {
    return this.buildElement()
  }

  updateHref () {
    this.el().setAttribute('href', buildVideoLink(this.player().currentTime()))
  }

  handleClick () {
    this.player_.pause()
  }

  private buildElement () {
    const el = videojsUntyped.dom.createEl('a', {
      href: buildVideoLink(),
      innerHTML: 'PeerTube',
      title: this.player_.localize('Go to the video page'),
      className: 'vjs-peertube-link',
      target: '_blank'
    })

    el.addEventListener('mouseenter', () => this.updateHref())

    return el
  }
}
Button.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)
