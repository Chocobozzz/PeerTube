import videojs from "video.js"
import { VideojsButtonOptions, VideojsMenuButton, VideojsPlayer } from "../../types"

const MenuButton = videojs.getComponent('MenuButton') as typeof VideojsMenuButton

class VideoFilterMenuButton extends MenuButton {
  constructor(player: VideojsPlayer, options: VideojsButtonOptions) {
    super(player, options)
    this.controlText("Video Filter")
  }

}

videojs.registerComponent('VideoFilterMenuButton', VideoFilterMenuButton)

export { VideoFilterMenuButton }
