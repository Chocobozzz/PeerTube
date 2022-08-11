import videojs from 'video.js'

const MenuItem = videojs.getComponent('MenuItem')

export interface ResolutionMenuItemOptions extends videojs.MenuItemOptions {
  resolutionId: number
}

class ResolutionMenuItem extends MenuItem {
  readonly resolutionId: number
  private readonly label: string

  private autoResolutionEnabled: boolean
  private autoResolutionChosen: string

  constructor (player: videojs.Player, options?: ResolutionMenuItemOptions) {
    options.selectable = true

    super(player, options)

    this.autoResolutionEnabled = true
    this.autoResolutionChosen = ''

    this.resolutionId = options.resolutionId
    this.label = options.label

    player.peertubeResolutions().on('resolutionChanged', () => this.updateSelection())

    // We only want to disable the "Auto" item
    if (this.resolutionId === -1) {
      player.peertubeResolutions().on('autoResolutionEnabledChanged', () => this.updateAutoResolution())
    }
  }

  handleClick (event: any) {
    // Auto button disabled?
    if (this.autoResolutionEnabled === false && this.resolutionId === -1) return

    super.handleClick(event)

    this.player().peertubeResolutions().select({ id: this.resolutionId, byEngine: false })
  }

  updateSelection () {
    const selectedResolution = this.player().peertubeResolutions().getSelected()

    if (this.resolutionId === -1) {
      this.autoResolutionChosen = this.player().peertubeResolutions().getAutoResolutionChosen()?.label
    }

    this.selected(this.resolutionId === selectedResolution.id)
  }

  updateAutoResolution () {
    const enabled = this.player().peertubeResolutions().isAutoResolutionEnabeld()

    // Check if the auto resolution is enabled or not
    if (enabled === false) {
      this.addClass('disabled')
    } else {
      this.removeClass('disabled')
    }

    this.autoResolutionEnabled = enabled
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
