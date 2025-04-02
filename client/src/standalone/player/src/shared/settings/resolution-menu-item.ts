import videojs from 'video.js'

const MenuItem = videojs.getComponent('MenuItem')

export interface ResolutionMenuItemOptions extends videojs.MenuItemOptions {
  resolutionId: number
}

class ResolutionMenuItem extends MenuItem {
  declare readonly resolutionId: number
  declare private readonly label: string

  declare private autoResolutionChosen: string

  declare private updateSelectionHandler: () => void

  constructor (player: videojs.Player, options?: ResolutionMenuItemOptions) {
    super(player, { ...options, selectable: true })

    this.autoResolutionChosen = ''

    this.resolutionId = options.resolutionId
    this.label = options.label

    this.updateSelectionHandler = () => this.updateSelection()
    player.peertubeResolutions().on('resolutions-changed', this.updateSelectionHandler)
  }

  dispose () {
    this.player().peertubeResolutions().off('resolutions-changed', this.updateSelectionHandler)

    super.dispose()
  }

  handleClick (event: any) {
    super.handleClick(event)

    this.player().peertubeResolutions().select({ id: this.resolutionId, fireCallback: true })
  }

  updateSelection () {
    const selectedResolution = this.player().peertubeResolutions().getSelected()

    if (this.resolutionId === -1) {
      this.autoResolutionChosen = this.player().peertubeResolutions().getAutoResolutionChosen()?.label
    }

    this.selected(this.resolutionId === selectedResolution.id)
  }

  getLabel () {
    if (this.resolutionId === -1) {
      return this.label + ' <small>' + this.autoResolutionChosen + '</small>'
    }

    return this.label
  }
}
videojs.registerComponent('ResolutionMenuItem', ResolutionMenuItem)

export { ResolutionMenuItem }
