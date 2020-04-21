import videojs from 'video.js'
import { saveTheaterInStore, getStoredTheater } from '../peertube-player-local-storage'

const Button = videojs.getComponent('Button')
class TheaterButton extends Button {

  private static readonly THEATER_MODE_CLASS = 'vjs-theater-enabled'

  constructor (player: videojs.Player, options: videojs.ComponentOptions) {
    super(player, options)

    const enabled = getStoredTheater()
    if (enabled === true) {
      this.player().addClass(TheaterButton.THEATER_MODE_CLASS)

      this.handleTheaterChange()
    }

    this.controlText('Theater mode')

    this.player().theaterEnabled = enabled
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

    this.player_.trigger('theaterChange', theaterEnabled)
  }

  handleClick () {
    this.player_.toggleClass(TheaterButton.THEATER_MODE_CLASS)

    this.handleTheaterChange()
  }

  private isTheaterEnabled () {
    return this.player_.hasClass(TheaterButton.THEATER_MODE_CLASS)
  }
}

videojs.registerComponent('TheaterButton', TheaterButton)
