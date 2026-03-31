import videojs from "video.js"
import { VideojsButtonOptions, VideojsMenu, VideojsMenuButton, VideojsPlayer } from "../../types"
import { VideoFilterMenuItem } from "./video-filter-menu-item"

const Menu = videojs.getComponent('Menu') as typeof VideojsMenu
const MenuButton = videojs.getComponent('MenuButton') as typeof VideojsMenuButton

class VideoFilterMenuButton extends MenuButton {
  declare labelEl_: HTMLElement

  constructor(player: VideojsPlayer, options: VideojsButtonOptions) {
    super(player, options)
    this.controlText("Video Filter")
  }

  createMenu() {
    const menu = new Menu(this.player_, { menuButton: this })
    menu.addItem(new VideoFilterMenuItem(this.player_, {label: "Mirror Video", videoFilter: "video-flip-horizontally"}))
    return menu
  }
}

videojs.registerComponent('VideoFilterMenuButton', VideoFilterMenuButton)

export { VideoFilterMenuButton }
