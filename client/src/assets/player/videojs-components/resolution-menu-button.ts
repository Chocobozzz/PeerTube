// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import { Player } from 'video.js'

import { LoadedQualityData, VideoJSComponentInterface, videojsUntyped } from '../peertube-videojs-typings'
import { ResolutionMenuItem } from './resolution-menu-item'

const Menu: VideoJSComponentInterface = videojsUntyped.getComponent('Menu')
const MenuButton: VideoJSComponentInterface = videojsUntyped.getComponent('MenuButton')
class ResolutionMenuButton extends MenuButton {
  label: HTMLElement

  constructor (player: Player, options: any) {
    super(player, options)
    this.player = player

    player.on('loadedqualitydata', (e: any, data: any) => this.buildQualities(data))

    if (player.webtorrent) {
      player.webtorrent().on('videoFileUpdate', () => setTimeout(() => this.trigger('updateLabel'), 0))
    }
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

  private buildQualities (data: LoadedQualityData) {
    // The automatic resolution item will need other labels
    const labels: { [ id: number ]: string } = {}

    for (const d of data.qualityData.video) {
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
  }
}
ResolutionMenuButton.prototype.controlText_ = 'Quality'

MenuButton.registerComponent('ResolutionMenuButton', ResolutionMenuButton)
