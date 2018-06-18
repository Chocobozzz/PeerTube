import { VideoJSComponentInterface, videojsUntyped } from './peertube-videojs-typings'
import { saveTheaterInStore } from './peertube-player-local-storage'
import { getStoredTheater } from './peertube-player-local-storage'

const Button: VideoJSComponentInterface = videojsUntyped.getComponent('Button')
class TheaterButton extends Button {

  private static readonly THEATER_MODE_CLASS = 'vjs-theater-enabled'

  constructor (player, options) {
    super(player, options)

    const enabled = getStoredTheater()
    if (enabled === true) {
      this.player_.addClass(TheaterButton.THEATER_MODE_CLASS)
      this.handleTheaterChange()
    }
  }

  buildCSSClass () {
    return `vjs-theater-control ${super.buildCSSClass()}`
  }

  handleTheaterChange () {
    if (this.isTheaterEnabled()) {
      this.controlText('Normal mode')
    } else {
      this.controlText('Theater mode')
    }

    saveTheaterInStore(this.isTheaterEnabled())
  }

  handleClick () {
    this.player_.toggleClass(TheaterButton.THEATER_MODE_CLASS)

    this.handleTheaterChange()
  }

  private isTheaterEnabled () {
    return this.player_.hasClass(TheaterButton.THEATER_MODE_CLASS)
  }
}

TheaterButton.prototype.controlText_ = 'Theater mode'

TheaterButton.registerComponent('TheaterButton', TheaterButton)
