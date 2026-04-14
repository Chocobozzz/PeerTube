import videojs from 'video.js'
import { VideojsButtonOptions, VideojsMenu, VideojsMenuButton, VideojsPlayer } from '../../types'
import { VideoFilterMenuItem } from './video-filter-menu-item'

const Menu = videojs.getComponent('Menu') as typeof VideojsMenu
const MenuButton = videojs.getComponent('MenuButton') as typeof VideojsMenuButton

class VideoFilterMenuButton extends MenuButton {
  declare labelEl_: HTMLElement

  constructor (player: VideojsPlayer, options: VideojsButtonOptions) {
    super(player, options)

    this.controlText(this.player().localize('Video Filter'))
  }

  createMenu () {
    const menu = new Menu(this.player_, { menuButton: this })

    const item = new VideoFilterMenuItem(this.player_, {
      label: this.player().localize('Mirror Video'),
      menuLabel: this.player().localize('Mirror'),
      videoFilter: 'video-flip-horizontally'
    })

    item.on('selected-updated', () => {
      this.trigger('label-updated')
    })

    menu.addItem(item)

    return menu
  }

  buildCSSClass () {
    return 'vjs-video-filter-button ' + super.buildCSSClass()
  }

  buildWrapperCSSClass () {
    return 'vjs-video-filter-control ' + super.buildWrapperCSSClass()
  }
}

videojs.registerComponent('VideoFilterMenuButton', VideoFilterMenuButton)

export { VideoFilterMenuButton }
