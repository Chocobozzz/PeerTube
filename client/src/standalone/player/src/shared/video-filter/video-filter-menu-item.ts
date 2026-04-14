import videojs from 'video.js'
import type { VideojsMenuItem, VideojsPlayer, VideojsMenuItemOptions } from '../../types'

const MenuItem = videojs.getComponent('MenuItem') as typeof VideojsMenuItem

export interface VideoFilterMenuItemMenuItemOptions extends VideojsMenuItemOptions {
  videoFilter?: string
}

class VideoFilterMenuItem extends MenuItem {
  menuLabel: string
  videoFilter: string

  constructor (player: VideojsPlayer, options?: VideoFilterMenuItemMenuItemOptions) {
    super(player, { ...options, selectable: true })

    this.videoFilter = options.videoFilter || ''
    this.menuLabel = options.menuLabel || ''

    this.player().on(`${this.videoFilter}-on`, () => {
      this.selected(true)

      this.trigger('selected-updated')
    })

    this.player().on(`${this.videoFilter}-off`, () => {
      this.selected(false)

      this.trigger('selected-updated')
    })
  }

  handleClick (): void {
    if (this.isSelected_) {
      this.player_.trigger(`${this.videoFilter}-off`)
    } else {
      this.player_.trigger(`${this.videoFilter}-on`)
    }
  }

  getLabel () {
    return this.menuLabel
  }
}

videojs.registerComponent('VideoFilterMenuItem', VideoFilterMenuItem)

export { VideoFilterMenuItem }
