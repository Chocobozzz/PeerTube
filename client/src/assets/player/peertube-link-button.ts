import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { buildVideoLink } from './utils'
// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import { Player } from 'video.js'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
class PeerTubeLinkButton extends Button {

  constructor (player: Player, options: any) {
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
