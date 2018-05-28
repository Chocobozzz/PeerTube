import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
class PeerTubeLinkButton extends Button {

  createEl () {
    return this.buildElement()
  }

  updateHref () {
    const currentTime = Math.floor(this.player().currentTime())
    this.el().setAttribute('href', this.buildHref(currentTime))
  }

  handleClick () {
    this.player_.pause()
  }

  private buildElement () {
    const el = videojsUntyped.dom.createEl('a', {
      href: this.buildHref(),
      innerHTML: 'PeerTube',
      title: 'Go to the video page',
      className: 'vjs-peertube-link',
      target: '_blank'
    })

    el.addEventListener('mouseenter', () => this.updateHref())

    return el
  }

  private buildHref (time?: number) {
    let href = window.location.href.replace('embed', 'watch')
    if (time) href += '?start=' + time

    return href
  }
}
Button.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)
