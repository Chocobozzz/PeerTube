import videojs from 'video.js'
import { UpNextPluginOptions } from '../../types'
import { EndCardOptions } from './end-card'

const Plugin = videojs.getPlugin('plugin')

class UpNextPlugin extends Plugin {

  constructor (player: videojs.Player, options: UpNextPluginOptions) {
    super(player)

    const settings: EndCardOptions = {
      next: options.next,
      getTitle: options.getTitle,
      timeout: options.timeout,
      cancelText: player.localize('Cancel'),
      headText: player.localize('Up Next'),
      suspendedText: player.localize('Autoplay is suspended'),
      isDisplayed: options.isDisplayed,
      isSuspended: options.isSuspended
    }

    this.player.ready(() => {
      player.addClass('vjs-upnext')
    })

    player.addChild('EndCard', settings)
  }
}

videojs.registerPlugin('upnext', UpNextPlugin)
export { UpNextPlugin }
