import videojs from 'video.js'
import { PeerTubeResolution } from '../../types'

const Plugin = videojs.getPlugin('plugin')

class PeerTubeResolutionsPlugin extends Plugin {
  private currentSelection: PeerTubeResolution
  private resolutions: PeerTubeResolution[] = []

  private autoResolutionChosenId: number
  private autoResolutionEnabled = true

  add (resolutions: PeerTubeResolution[]) {
    for (const r of resolutions) {
      this.resolutions.push(r)
    }

    this.currentSelection = this.getSelected()

    this.sort()
    this.trigger('resolutionsAdded')
  }

  remove (resolutionIndex: number) {
    this.resolutions = this.resolutions.filter(r => r.id !== resolutionIndex)
    this.trigger('resolutionRemoved')
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
    byEngine: boolean
    autoResolutionChosenId?: number
  }) {
    const { id, autoResolutionChosenId, byEngine } = options

    if (this.currentSelection?.id === id && this.autoResolutionChosenId === autoResolutionChosenId) return

    this.autoResolutionChosenId = autoResolutionChosenId

    for (const r of this.resolutions) {
      r.selected = r.id === id

      if (r.selected) {
        this.currentSelection = r

        if (!byEngine) r.selectCallback()
      }
    }

    this.trigger('resolutionChanged')
  }

  disableAutoResolution () {
    this.autoResolutionEnabled = false
    this.trigger('autoResolutionEnabledChanged')
  }

  enabledAutoResolution () {
    this.autoResolutionEnabled = true
    this.trigger('autoResolutionEnabledChanged')
  }

  isAutoResolutionEnabeld () {
    return this.autoResolutionEnabled
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
