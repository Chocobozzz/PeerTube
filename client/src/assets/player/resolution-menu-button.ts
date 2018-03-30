import * as videojs from 'video.js'
import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { ResolutionMenuItem } from './resolution-menu-item'

const Menu: VideoJSComponentInterface = videojsUntyped.getComponent('Menu')
const MenuButton: VideoJSComponentInterface = videojsUntyped.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  label: HTMLElement

  constructor (player: videojs.Player, options) {
    options.label = 'Quality'
    super(player, options)

    this.controlText_ = 'Quality'
    this.player = player

    player.peertube().on('videoFileUpdate', () => this.updateLabel())
  }

  createEl () {
    const el = super.createEl()

    this.labelEl_ = videojsUntyped.dom.createEl('div', {
      className: 'vjs-resolution-value',
      innerHTML: this.player_.peertube().getCurrentResolutionLabel()
    })

    el.appendChild(this.labelEl_)

    return el
  }

  updateARIAAttributes () {
    this.el().setAttribute('aria-label', 'Quality')
  }

  createMenu () {
    const menu = new Menu(this.player())

    for (const videoFile of this.player_.peertube().videoFiles) {
      menu.addChild(new ResolutionMenuItem(
        this.player_,
        {
          id: videoFile.resolution.id,
          label: videoFile.resolution.label,
          src: videoFile.magnetUri
        })
      )
    }

    return menu
  }

  updateLabel () {
    if (!this.labelEl_) return

    this.labelEl_.innerHTML = this.player_.peertube().getCurrentResolutionLabel()
  }

  buildCSSClass () {
    return super.buildCSSClass() + ' vjs-resolution-button'
  }

  buildWrapperCSSClass () {
    return 'vjs-resolution-control ' + super.buildWrapperCSSClass()
  }
}
MenuButton.registerComponent('ResolutionMenuButton', ResolutionMenuButton)
