import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'

const MenuItem: VideoJSComponentInterface = videojsUntyped.getComponent('MenuItem')
class ResolutionMenuItem extends MenuItem {

  constructor (player: videojs.Player, options) {
    const currentResolutionId = player.peertube().getCurrentResolutionId()
    options.selectable = true
    options.selected = options.id === currentResolutionId

    super(player, options)

    this.label = options.label
    this.id = options.id

    player.peertube().on('videoFileUpdate', () => this.update())
  }

  handleClick (event) {
    super.handleClick(event)

    this.player_.peertube().updateResolution(this.id)
  }

  update () {
    this.selected(this.player_.peertube().getCurrentResolutionId() === this.id)
  }
}
MenuItem.registerComponent('ResolutionMenuItem', ResolutionMenuItem)

export { ResolutionMenuItem }
