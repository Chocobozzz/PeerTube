import videojs from "video.js"
import { VideojsButtonOptions, VideojsMenuButton, VideojsPlayer } from "../../types"
import Menu from "video.js/dist/types/menu/menu"

const MenuButton = videojs.getComponent('MenuButton') as typeof VideojsMenuButton

class VideoFilterMenuButton extends MenuButton {
  constructor(player: VideojsPlayer, options: VideojsButtonOptions) {
    super(player, options)
    this.controlText("Video Filter")
  }

  createMenu(): Menu {
    const menu = new Menu(this.player_, { menuButton: this })
    return menu
  }

}

videojs.registerComponent('VideoFilterMenuButton', VideoFilterMenuButton)

export { VideoFilterMenuButton }
