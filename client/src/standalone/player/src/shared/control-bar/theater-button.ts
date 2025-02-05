import videojs from 'video.js'
import { getStoredTheater, saveTheaterInStore } from '../../peertube-player-local-storage'
import { TheaterButtonOptions } from '../../types'

const Button = videojs.getComponent('Button')
class TheaterButton extends Button {

  private static readonly THEATER_MODE_CLASS = 'vjs-theater-enabled'

  declare private theaterButtonOptions: TheaterButtonOptions

  constructor (player: videojs.Player, options: TheaterButtonOptions & videojs.ComponentOptions) {
    super(player, options)

    this.theaterButtonOptions = options

    const enabled = getStoredTheater()
    if (enabled === true) {
      this.player().addClass(TheaterButton.THEATER_MODE_CLASS)

      this.handleTheaterChange()
    }

    this.controlText('Theater mode')

    this.player().theaterEnabled = enabled

    this.updateShowing()
    this.player().on('video-change', () => this.updateShowing())
  }

  buildCSSClass () {
    return `vjs-theater-control ${super.buildCSSClass()}`
  }

  handleTheaterChange () {
    const theaterEnabled = this.isTheaterEnabled()

    if (theaterEnabled) {
      this.controlText('Normal mode')
    } else {
      this.controlText('Theater mode')
    }

    saveTheaterInStore(theaterEnabled)

    this.player_.trigger('theater-change', theaterEnabled)
  }

  handleClick () {
    this.player_.toggleClass(TheaterButton.THEATER_MODE_CLASS)

    this.handleTheaterChange()
  }

  private isTheaterEnabled () {
    return this.player_.hasClass(TheaterButton.THEATER_MODE_CLASS)
  }

  private updateShowing () {
    if (this.theaterButtonOptions.isDisplayed()) this.show()
    else this.hide()
  }
}

videojs.registerComponent('TheaterButton', TheaterButton)
