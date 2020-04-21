import videojs from 'video.js'

import { LoadedQualityData } from '../peertube-videojs-typings'
import { ResolutionMenuItem } from './resolution-menu-item'

const Menu = videojs.getComponent('Menu')
const MenuButton = videojs.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  labelEl_: HTMLElement

  constructor (player: videojs.Player, options?: videojs.MenuButtonOptions) {
    super(player, options)

    this.controlText('Quality')

    player.tech(true).on('loadedqualitydata', (e: any, data: any) => this.buildQualities(data))

    player.peertube().on('resolutionChange', () => setTimeout(() => this.trigger('updateLabel'), 0))
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

      const label = d.label === '0p'
        ? this.player().localize('Audio-only')
        : d.label

      this.menu.addChild(new ResolutionMenuItem(
        this.player_,
        {
          id: d.id,
          label,
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

videojs.registerComponent('ResolutionMenuButton', ResolutionMenuButton)
