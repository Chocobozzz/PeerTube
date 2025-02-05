import videojs from 'video.js'
import { ResolutionMenuItem } from './resolution-menu-item'

const Menu = videojs.getComponent('Menu')
const MenuButton = videojs.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  declare labelEl_: HTMLElement

  constructor (player: videojs.Player, options?: videojs.MenuButtonOptions) {
    super(player, options)

    this.controlText('Quality')

    player.peertubeResolutions().on('resolutions-added', () => this.update())
    player.peertubeResolutions().on('resolutions-removed', () => this.update())

    // For parent
    player.peertubeResolutions().on('resolutions-changed', () => {
      setTimeout(() => this.trigger('label-updated'))
    })
  }

  createEl () {
    const el = super.createEl()

    this.labelEl_ = videojs.dom.createEl('div', {
      className: 'vjs-resolution-value'
    }) as HTMLElement

    el.appendChild(this.labelEl_)

    return el
  }

  updateARIAAttributes () {
    this.el().setAttribute('aria-label', 'Quality')
  }

  createMenu () {
    const menu: videojs.Menu = new Menu(this.player_, { menuButton: this })
    const resolutions = this.player().peertubeResolutions().getResolutions()

    for (const r of resolutions) {
      const label = r.label === '0p'
        ? this.player().localize('Audio only')
        : r.label

      const component = new ResolutionMenuItem(
        this.player_,
        {
          id: r.id + '',
          resolutionId: r.id,
          label,
          selected: r.selected
        }
      )

      menu.addItem(component)
    }

    return menu
  }

  update () {
    super.update()

    this.trigger('resolution-menu-changed')
  }

  buildCSSClass () {
    return 'vjs-resolution-button ' + super.buildCSSClass()
  }

  buildWrapperCSSClass () {
    return 'vjs-resolution-control ' + super.buildWrapperCSSClass()
  }
}

videojs.registerComponent('ResolutionMenuButton', ResolutionMenuButton)
