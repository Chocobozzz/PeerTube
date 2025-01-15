import {
  NextPreviousVideoButtonOptions,
  PeerTubeLinkButtonOptions,
  PeerTubePlayerConstructorOptions,
  PeerTubePlayerLoadOptions,
  TheaterButtonOptions
} from '../../types'

type ControlBarOptionsBuilderConstructorOptions =
  Pick<PeerTubePlayerConstructorOptions, 'peertubeLink' | 'instanceName' | 'theaterButton'> &
  {
    videoShortUUID: () => string
    p2pEnabled: () => boolean

    previousVideo: () => PeerTubePlayerLoadOptions['previousVideo']
    nextVideo: () => PeerTubePlayerLoadOptions['nextVideo']
  }

export class ControlBarOptionsBuilder {

  constructor (private options: ControlBarOptionsBuilderConstructorOptions) {
  }

  getChildrenOptions () {
    const children = {
      ...this.getPreviousVideo(),

      playToggle: {},

      ...this.getNextVideo(),

      ...this.getTimeControls(),

      ...this.getProgressControl(),

      p2PInfoButton: {},

      muteToggle: {},
      volumeControl: {},

      captionToggleButton: {},

      ...this.getSettingsButton(),

      ...this.getPeerTubeLinkButton(),

      ...this.getTheaterButton(),

      fullscreenToggle: {}
    }

    return children
  }

  private getSettingsButton () {
    const settingEntries: string[] = []

    settingEntries.push('playbackRateMenuButton')
    settingEntries.push('captionsButton')
    settingEntries.push('resolutionMenuButton')

    return {
      settingsButton: {
        setup: {
          maxHeightOffset: 60
        },
        entries: settingEntries
      }
    }
  }

  private getTimeControls () {
    return {
      peerTubeLiveDisplay: {},

      currentTimeDisplay: {},
      timeDivider: {},
      durationDisplay: {}
    }
  }

  private getProgressControl () {
    return {
      progressControl: {
        children: {
          seekBar: {
            children: {
              loadProgressBar: {},
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
      handler: () => this.options.previousVideo().handler(),
      isDisabled: () => !this.options.previousVideo().enabled,
      isDisplayed: () => this.options.previousVideo().displayControlBarButton
    }

    return { previousVideoButton: buttonOptions }
  }

  private getNextVideo () {
    const buttonOptions: NextPreviousVideoButtonOptions = {
      type: 'next',
      handler: () => this.options.nextVideo().handler(),
      isDisabled: () => !this.options.nextVideo().enabled,
      isDisplayed: () => this.options.nextVideo().displayControlBarButton
    }

    return { nextVideoButton: buttonOptions }
  }

  private getPeerTubeLinkButton () {
    const options: PeerTubeLinkButtonOptions = {
      isDisplayed: this.options.peertubeLink,
      shortUUID: this.options.videoShortUUID,
      instanceName: this.options.instanceName
    }

    return { peerTubeLinkButton: options }
  }

  private getTheaterButton () {
    const options: TheaterButtonOptions = {
      isDisplayed: () => this.options.theaterButton
    }

    return {
      theaterButton: options
    }
  }
}
