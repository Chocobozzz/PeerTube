import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
class PeerTubeLinkButton extends Button {

  createEl () {
    return videojsUntyped.dom.createEl('a', {
      href: window.location.href.replace('embed', 'watch'),
      innerHTML: 'PeerTube',
      title: 'Go to the video page',
      className: 'vjs-peertube-link',
      target: '_blank'
    })
  }

  handleClick () {
    this.player_.pause()
  }
}
Button.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)
