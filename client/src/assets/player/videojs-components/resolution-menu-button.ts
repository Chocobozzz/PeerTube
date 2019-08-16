// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import { Player } from 'video.js'

import { LoadedQualityData, VideoJSComponentInterface, videojsUntyped } from '../peertube-videojs-typings'
import { ResolutionMenuItem } from './resolution-menu-item'

const Menu: VideoJSComponentInterface = videojsUntyped.getComponent('Menu')
const MenuButton: VideoJSComponentInterface = videojsUntyped.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  label: HTMLElement
  labelEl_: any
  player: Player

  constructor (player: Player, options: any) {
    super(player, options)
    this.player = player

    player.tech_.on('loadedqualitydata', (e: any, data: any) => this.buildQualities(data))

    player.peertube().on('resolutionChange', () => setTimeout(() => this.trigger('updateLabel'), 0))
  }

  createEl () {
    const el = super.createEl()

    this.labelEl_ = videojsUntyped.dom.createEl('div', {
      className: 'vjs-resolution-value'
    })

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
          child.selected(false)
        }
      }
    })
  }

  private buildQualities (data: LoadedQualityData) {
    // The automatic resolution item will need other labels
    const labels: { [ id: number ]: string } = {}

    data.qualityData.video.sort((a, b) => {
      if (a.id > b.id) return -1
      if (a.id === b.id) return 0
      return 1
    })

    for (const d of data.qualityData.video) {
      // Skip auto resolution, we'll add it ourselves
      if (d.id === -1) continue

      this.menu.addChild(new ResolutionMenuItem(
        this.player_,
        {
          id: d.id,
          label: d.label,
          selected: d.selected,
          callback: data.qualitySwitchCallback
        })
      )

      labels[d.id] = d.label
    }

    this.menu.addChild(new ResolutionMenuItem(
      this.player_,
      {
        id: -1,
        label: this.player_.localize('Auto'),
        labels,
        callback: data.qualitySwitchCallback,
        selected: true // By default, in auto mode
      }
    ))

    for (const m of this.menu.children()) {
      this.addClickListener(m)
    }

    this.trigger('menuChanged')
  }
}
ResolutionMenuButton.prototype.controlText_ = 'Quality'

MenuButton.registerComponent('ResolutionMenuButton', ResolutionMenuButton)
