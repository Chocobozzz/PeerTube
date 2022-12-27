import {
  CommonOptions,
  NextPreviousVideoButtonOptions,
  PeerTubeLinkButtonOptions,
  PeertubePlayerManagerOptions,
  PlayerMode
} from '../../types'

export class ControlBarOptionsBuilder {
  private options: CommonOptions

  constructor (
    globalOptions: PeertubePlayerManagerOptions,
    private mode: PlayerMode
  ) {
    this.options = globalOptions.common
  }

  getChildrenOptions () {
    const children = {}

    if (this.options.previousVideo) {
      Object.assign(children, this.getPreviousVideo())
    }

    Object.assign(children, { playToggle: {} })

    if (this.options.nextVideo) {
      Object.assign(children, this.getNextVideo())
    }

    Object.assign(children, {
      ...this.getTimeControls(),

      flexibleWidthSpacer: {},

      ...this.getProgressControl(),

      p2PInfoButton: {
        p2pEnabled: this.options.p2pEnabled
      },

      muteToggle: {},
      volumeControl: {},

      ...this.getSettingsButton()
    })

    if (this.options.peertubeLink === true) {
      Object.assign(children, {
        peerTubeLinkButton: {
          shortUUID: this.options.videoShortUUID,
          instanceName: this.options.instanceName
        } as PeerTubeLinkButtonOptions
      })
    }

    if (this.options.theaterButton === true) {
      Object.assign(children, {
        theaterButton: {}
      })
    }

    Object.assign(children, {
      fullscreenToggle: {}
    })

    return children
  }

  private getSettingsButton () {
    const settingEntries: string[] = []

    settingEntries.push('playbackRateMenuButton')

    if (this.options.captions === true) settingEntries.push('captionsButton')

    settingEntries.push('resolutionMenuButton')

    return {
      settingsButton: {
        setup: {
          maxHeightOffset: 40
        },
        entries: settingEntries
      }
    }
  }

  private getTimeControls () {
    if (this.options.isLive) {
      return {
        peerTubeLiveDisplay: {}
      }
    }

    return {
      currentTimeDisplay: {},
      timeDivider: {},
      durationDisplay: {}
    }
  }

  private getProgressControl () {
    if (this.options.isLive) return {}

    const loadProgressBar = this.mode === 'webtorrent'
      ? 'peerTubeLoadProgressBar'
      : 'loadProgressBar'

    return {
      progressControl: {
        children: {
          seekBar: {
            children: {
              [loadProgressBar]: {},
              mouseTimeDisplay: {},
              playProgressBar: {}
            }
          }
        }
      }
    }
  }

  private getPreviousVideo () {
    const buttonOptions: NextPreviousVideoButtonOptions = {
      type: 'previous',
      handler: this.options.previousVideo,
      isDisabled: () => {
        if (!this.options.hasPreviousVideo) return false

        return !this.options.hasPreviousVideo()
      }
    }

    return { previousVideoButton: buttonOptions }
  }

  private getNextVideo () {
    const buttonOptions: NextPreviousVideoButtonOptions = {
      type: 'next',
      handler: this.options.nextVideo,
      isDisabled: () => {
        if (!this.options.hasNextVideo) return false

        return !this.options.hasNextVideo()
      }
    }

    return { nextVideoButton: buttonOptions }
  }
}
