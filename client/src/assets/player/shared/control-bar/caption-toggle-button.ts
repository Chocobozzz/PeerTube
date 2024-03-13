import videojs from 'video.js'
import { TheaterButtonOptions } from '../../types'
import { getStoredPreferredSubtitle } from '../../peertube-player-local-storage'

const Button = videojs.getComponent('Button')
class CaptionToggleButton extends Button {

  constructor (player: videojs.Player, options: TheaterButtonOptions & videojs.ComponentOptions) {
    super(player, options)

    player.on('texttrackchange', () => this.update())
  }

  buildCSSClass () {
    // Inherits vjs-captions-button for the icon
    return `vjs-caption-toggle-control vjs-captions-button ${super.buildCSSClass()}`
  }

  handleClick (event: any) {
    super.handleClick(event)

    const toEnable = this.getShowing()
      ? undefined
      : this.getCaptionToEnable()?.id

    for (const track of this.player_.textTracks().tracks_) {
      if (toEnable && track.id === toEnable) track.mode = 'showing'
      else track.mode = 'disabled'
    }
  }

  private update () {
    if (this.getShowing()) {
      this.controlText('Disable subtitles')
      this.addClass('enabled')
      return
    }

    this.controlText(this.player_.localize('Enable {1} subtitle', [ this.getCaptionToEnable()?.label ]))
    this.removeClass('enabled')
  }

  private getShowing () {
    return this.listCaptions().find(t => t.mode === 'showing')
  }

  private getCaptionToEnable () {
    const captionToEnable = getStoredPreferredSubtitle() || this.listCaptions()[0]?.id
    const captions = this.listCaptions()

    return captions.find(t => t.id === captionToEnable) || captions[0]
  }

  private listCaptions () {
    return this.player_.textTracks().tracks_.filter(t => t.kind === 'captions')
  }
}

videojs.registerComponent('CaptionToggleButton', CaptionToggleButton)
