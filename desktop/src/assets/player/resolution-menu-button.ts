import * as videojs from 'video.js'
import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { ResolutionMenuItem } from './resolution-menu-item'

const Menu: VideoJSComponentInterface = videojsUntyped.getComponent('Menu')
const MenuButton: VideoJSComponentInterface = videojsUntyped.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  label: HTMLElement

  constructor (player: videojs.Player, options) {
    super(player, options)
    this.player = player

    player.peertube().on('videoFileUpdate', () => this.updateLabel())
    player.peertube().on('autoResolutionUpdate', () => this.updateLabel())
  }

  createEl () {
    const el = super.createEl()

    this.labelEl_ = videojsUntyped.dom.createEl('div', {
      className: 'vjs-resolution-value',
      innerHTML: this.buildLabelHTML()
    })

    el.appendChild(this.labelEl_)

    return el
  }

  updateARIAAttributes () {
    this.el().setAttribute('aria-label', 'Quality')
  }

  createMenu () {
    const menu = new Menu(this.player_)
    for (const videoFile of this.player_.peertube().videoFiles) {
      let label = videoFile.resolution.label
      if (videoFile.fps && videoFile.fps >= 50) {
        label += videoFile.fps
      }

      menu.addChild(new ResolutionMenuItem(
        this.player_,
        {
          id: videoFile.resolution.id,
          label,
          src: videoFile.magnetUri
        })
      )
    }

    menu.addChild(new ResolutionMenuItem(
      this.player_,
      {
        id: -1,
        label: this.player_.localize('Auto'),
        src: null
      }
    ))

    return menu
  }

  updateLabel () {
    if (!this.labelEl_) return

    this.labelEl_.innerHTML = this.buildLabelHTML()
  }

  buildCSSClass () {
    return super.buildCSSClass() + ' vjs-resolution-button'
  }

  buildWrapperCSSClass () {
    return 'vjs-resolution-control ' + super.buildWrapperCSSClass()
  }

  private buildLabelHTML () {
    return this.player_.peertube().getCurrentResolutionLabel()
  }
}
ResolutionMenuButton.prototype.controlText_ = 'Quality'

MenuButton.registerComponent('ResolutionMenuButton', ResolutionMenuButton)
