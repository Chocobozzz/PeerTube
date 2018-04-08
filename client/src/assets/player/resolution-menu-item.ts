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

    player.peertube().on('videoFileUpdate', () => this.updateSelection())
    player.peertube().on('autoResolutionUpdate', () => this.updateSelection())
  }

  handleClick (event) {
    super.handleClick(event)

    // Auto resolution
    if (this.id === -1) {
      this.player_.peertube().enableAutoResolution()
      return
    }

    this.player_.peertube().disableAutoResolution()
    this.player_.peertube().updateResolution(this.id)
  }

  updateSelection () {
    if (this.player_.peertube().isAutoResolutionOn()) {
      this.selected(this.id === -1)
      return
    }

    this.selected(this.player_.peertube().getCurrentResolutionId() === this.id)
  }

  getLabel () {
    if (this.id === -1) {
      return this.label + ' <small>' + this.player_.peertube().getCurrentResolutionLabel() + '</small>'
    }

    return this.label
  }
}
MenuItem.registerComponent('ResolutionMenuItem', ResolutionMenuItem)

export { ResolutionMenuItem }
