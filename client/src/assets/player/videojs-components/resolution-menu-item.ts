// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import { Player } from 'video.js'

import { AutoResolutionUpdateData, ResolutionUpdateData, VideoJSComponentInterface, videojsUntyped } from '../peertube-videojs-typings'

const MenuItem: VideoJSComponentInterface = videojsUntyped.getComponent('MenuItem')
class ResolutionMenuItem extends MenuItem {
  private readonly id: number
  private readonly label: string
  // Only used for the automatic item
  private readonly labels: { [id: number]: string }
  private readonly callback: Function

  private autoResolutionPossible: boolean
  private currentResolutionLabel: string

  constructor (player: Player, options: any) {
    options.selectable = true

    super(player, options)

    this.autoResolutionPossible = true
    this.currentResolutionLabel = ''

    this.label = options.label
    this.labels = options.labels
    this.id = options.id
    this.callback = options.callback

    player.peertube().on('resolutionChange', (_: any, data: ResolutionUpdateData) => this.updateSelection(data))

    // We only want to disable the "Auto" item
    if (this.id === -1) {
      player.peertube().on('autoResolutionChange', (_: any, data: AutoResolutionUpdateData) => this.updateAutoResolution(data))
    }
  }

  handleClick (event: any) {
    // Auto button disabled?
    if (this.autoResolutionPossible === false && this.id === -1) return

    super.handleClick(event)

    this.callback(this.id, 'video')
  }

  updateSelection (data: ResolutionUpdateData) {
    if (this.id === -1) {
      this.currentResolutionLabel = this.labels[data.id]
    }

    // Automatic resolution only
    if (data.auto === true) {
      this.selected(this.id === -1)
      return
    }

    this.selected(this.id === data.id)
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
    if (this.id === -1) {
      return this.label + ' <small>' + this.currentResolutionLabel + '</small>'
    }

    return this.label
  }
}
MenuItem.registerComponent('ResolutionMenuItem', ResolutionMenuItem)

export { ResolutionMenuItem }
