import videojs from 'video.js'
import { PeerTubeResolution } from '../../types'

const Plugin = videojs.getPlugin('plugin')

class PeerTubeResolutionsPlugin extends Plugin {
  declare private currentSelection: PeerTubeResolution
  declare private resolutions: PeerTubeResolution[]

  declare private autoResolutionChosenId: number

  constructor (player: videojs.Player) {
    super(player)

    this.resolutions = []

    player.on('video-change', () => {
      this.resolutions = []

      this.trigger('resolutions-removed')
    })
  }

  add (resolutions: PeerTubeResolution[]) {
    for (const r of resolutions) {
      this.resolutions.push(r)
    }

    this.currentSelection = this.getSelected()

    this.sort()
    this.trigger('resolutions-added')
  }

  remove (resolutionIndex: number) {
    this.resolutions = this.resolutions.filter(r => r.id !== resolutionIndex)
    this.trigger('resolutions-removed')
  }

  getResolutions () {
    return this.resolutions
  }

  getSelected () {
    return this.resolutions.find(r => r.selected)
  }

  getAutoResolutionChosen () {
    return this.resolutions.find(r => r.id === this.autoResolutionChosenId)
  }

  select (options: {
    id: number
    fireCallback: boolean
    autoResolutionChosenId?: number
  }) {
    const { id, autoResolutionChosenId, fireCallback } = options

    if (this.currentSelection?.id === id && this.autoResolutionChosenId === autoResolutionChosenId) return

    if (autoResolutionChosenId !== undefined) {
      this.autoResolutionChosenId = autoResolutionChosenId
    }

    for (const r of this.resolutions) {
      r.selected = r.id === id

      if (r.selected) {
        this.currentSelection = r

        if (fireCallback) r.selectCallback()
      }
    }

    this.trigger('resolutions-changed')
  }

  private sort () {
    this.resolutions.sort((a, b) => {
      if (a.id === -1) return 1
      if (b.id === -1) return -1

      if (a.height > b.height) return -1
      if (a.height === b.height) return 0
      return 1
    })
  }

}

videojs.registerPlugin('peertubeResolutions', PeerTubeResolutionsPlugin)
export { PeerTubeResolutionsPlugin }
