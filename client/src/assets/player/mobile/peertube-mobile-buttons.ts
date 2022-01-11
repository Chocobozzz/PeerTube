import videojs from 'video.js'

import debug from 'debug'

const logger = debug('peertube:player:mobile')

const Component = videojs.getComponent('Component')
class PeerTubeMobileButtons extends Component {

  createEl () {
    const container = super.createEl('div', {
      className: 'vjs-mobile-buttons-overlay'
    }) as HTMLDivElement

    container.addEventListener('click', () => {
      logger('Set user as inactive')

      this.player_.userActive(false)
    })

    const mainButton = super.createEl('div', {
      className: 'main-button'
    }) as HTMLDivElement

    mainButton.addEventListener('click', e => {
      e.stopPropagation()

      if (this.player_.paused() || this.player_.ended()) {
        this.player_.play()
        return
      }

      this.player_.pause()
    })

    container.appendChild(mainButton)

    return container
  }
}

videojs.registerComponent('PeerTubeMobileButtons', PeerTubeMobileButtons)
