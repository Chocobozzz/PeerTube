import { VideoJSComponentInterface, videojsUntyped } from '../peertube-videojs-typings'
// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import { Player } from 'video.js'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')

class NextVideoButton extends Button {

  constructor (player: Player, options: any) {
    super(player, options)
  }

  createEl () {
    const button = videojsUntyped.dom.createEl('button', {
      className: 'vjs-next-video'
    })
    const nextIcon = videojsUntyped.dom.createEl('span', {
      className: 'icon icon-next'
    })
    button.appendChild(nextIcon)

    button.title = this.player_.localize('Next video')

    return button
  }

  handleClick () {
    this.options_.handler()
  }

}

NextVideoButton.prototype.controlText_ = 'Next video'

NextVideoButton.registerComponent('NextVideoButton', NextVideoButton)
