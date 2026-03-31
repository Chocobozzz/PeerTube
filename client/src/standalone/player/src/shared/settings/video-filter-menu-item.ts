import videojs from "video.js"
import type { VideojsMenuItem, VideojsPlayer, VideojsMenuItemOptions } from "../../types"

const MenuItem = videojs.getComponent("MenuItem") as typeof VideojsMenuItem

class VideoFilterMenuItem extends MenuItem {
  flipVideo: boolean
  label: string
  videoFilter: string

  constructor(player: VideojsPlayer, options: VideojsMenuItemOptions) {
    super(player, options)
    this.flipVideo = false
    this.videoFilter = options.videoFilter
  }
  handleClick(): void {
    this.flipVideo = !this.flipVideo
    if (this.flipVideo && this.videoFilter) {
      this.player_.trigger(`${this.videoFilter}-on`)
    } else {
      this.player_.trigger(`${this.videoFilter}-off`)
    }
  }
}

videojs.registerComponent("VideoFilterMenuItem", VideoFilterMenuItem)

export { VideoFilterMenuItem }
