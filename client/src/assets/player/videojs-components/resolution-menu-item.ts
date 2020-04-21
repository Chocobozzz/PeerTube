import videojs from 'video.js'
import { AutoResolutionUpdateData, ResolutionUpdateData } from '../peertube-videojs-typings'

const MenuItem = videojs.getComponent('MenuItem')

export interface ResolutionMenuItemOptions extends videojs.MenuItemOptions {
  labels?: { [id: number]: string }
  id: number
  callback: Function
}

class ResolutionMenuItem extends MenuItem {
  private readonly resolutionId: number
  private readonly label: string
  // Only used for the automatic item
  private readonly labels: { [id: number]: string }
  private readonly callback: Function

  private autoResolutionPossible: boolean
  private currentResolutionLabel: string

  constructor (player: videojs.Player, options?: ResolutionMenuItemOptions) {
    options.selectable = true

    super(player, options)

    this.autoResolutionPossible = true
    this.currentResolutionLabel = ''

    this.resolutionId = options.id
    this.label = options.label
    this.labels = options.labels
    this.callback = options.callback

    player.peertube().on('resolutionChange', (_: any, data: ResolutionUpdateData) => this.updateSelection(data))

    // We only want to disable the "Auto" item
    if (this.resolutionId === -1) {
      player.peertube().on('autoResolutionChange', (_: any, data: AutoResolutionUpdateData) => this.updateAutoResolution(data))
    }
  }

  handleClick (event: any) {
    // Auto button disabled?
    if (this.autoResolutionPossible === false && this.resolutionId === -1) return

    super.handleClick(event)

    this.callback(this.resolutionId, 'video')
  }

  updateSelection (data: ResolutionUpdateData) {
    if (this.resolutionId === -1) {
      this.currentResolutionLabel = this.labels[data.id]
    }

    // Automatic resolution only
    if (data.auto === true) {
      this.selected(this.resolutionId === -1)
      return
    }

    this.selected(this.resolutionId === data.id)
  }

  updateAutoResolution (data: AutoResolutionUpdateData) {
    // Check if the auto resolution is enabled or not
    if (data.possible === false) {
      this.addClass('disabled')
    } else {
      this.removeClass('disabled')
    }

    this.autoResolutionPossible = data.possible
  }

  getLabel () {
    if (this.resolutionId === -1) {
      return this.label + ' <small>' + this.currentResolutionLabel + '</small>'
    }

    return this.label
  }
}
videojs.registerComponent('ResolutionMenuItem', ResolutionMenuItem)

export { ResolutionMenuItem }
