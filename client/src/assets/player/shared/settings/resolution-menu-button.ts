import videojs from 'video.js'
import { ResolutionMenuItem } from './resolution-menu-item'

const Menu = videojs.getComponent('Menu')
const MenuButton = videojs.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  labelEl_: HTMLElement

  constructor (player: videojs.Player, options?: videojs.MenuButtonOptions) {
    super(player, options)

    this.controlText('Quality')

    player.peertubeResolutions().on('resolutionsAdded', () => this.buildQualities())
    player.peertubeResolutions().on('resolutionRemoved', () => this.cleanupQualities())

    // For parent
    player.peertubeResolutions().on('resolutionChanged', () => {
      setTimeout(() => this.trigger('labelUpdated'))
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
    return new Menu(this.player_)
  }

  buildCSSClass () {
    return super.buildCSSClass() + ' vjs-resolution-button'
  }

  buildWrapperCSSClass () {
    return 'vjs-resolution-control ' + super.buildWrapperCSSClass()
  }

  private addClickListener (component: any) {
    component.on('click', () => {
      const children = this.menu.children()

      for (const child of children) {
        if (component !== child) {
          (child as videojs.MenuItem).selected(false)
        }
      }
    })
  }

  private buildQualities () {
    for (const d of this.player().peertubeResolutions().getResolutions()) {
      const label = d.label === '0p'
        ? this.player().localize('Audio-only')
        : d.label

      this.menu.addChild(new ResolutionMenuItem(
        this.player_,
        {
          id: d.id + '',
          resolutionId: d.id,
          label,
          selected: d.selected
        })
      )
    }

    for (const m of this.menu.children()) {
      this.addClickListener(m)
    }

    this.trigger('menuChanged')
  }

  private cleanupQualities () {
    const resolutions = this.player().peertubeResolutions().getResolutions()

    this.menu.children().forEach((children: ResolutionMenuItem) => {
      if (children.resolutionId === undefined) {
        return
      }

      if (resolutions.find(r => r.id === children.resolutionId)) {
        return
      }

      this.menu.removeChild(children)
    })

    this.trigger('menuChanged')
  }
}

videojs.registerComponent('ResolutionMenuButton', ResolutionMenuButton)
