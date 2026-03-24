import videojs from "video.js"
import type { VideojsMenuItem, VideojsPlayer, VideojsMenuItemOptions } from "../../types"

const MenuItem = videojs.getComponent("MenuItem") as typeof VideojsMenuItem

class VideoFilterMenuItem extends MenuItem {
  flipVideo: boolean
  label: string

  constructor(player: VideojsPlayer, options: VideojsMenuItemOptions) {
    super(player, options)
    this.flipVideo = false
  }
  handleClick(): void {
    this.flipVideo = !this.flipVideo
    if (this.flipVideo) {
      this.player_.trigger("video-flip-horizontally-on")
    } else {
      this.player_.trigger("video-flip-horizontally-off")
    }
  }
}

videojs.registerComponent("VideoFilterMenuItem", VideoFilterMenuItem)

export { VideoFilterMenuItem }
