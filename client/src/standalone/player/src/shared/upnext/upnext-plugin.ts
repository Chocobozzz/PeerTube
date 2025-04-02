import videojs from 'video.js'
import { UpNextPluginOptions } from '../../types'
import { EndCard, EndCardOptions } from './end-card'

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

    const component = new EndCard(player, settings)

    player.addChild(component)
    this.on('dispose', () => player.removeChild(component))
  }
}

videojs.registerPlugin('upnext', UpNextPlugin)
export { UpNextPlugin }
