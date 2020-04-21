import videojs from 'video.js'
import { EndCardOptions } from './end-card'

const Plugin = videojs.getPlugin('plugin')

class UpNextPlugin extends Plugin {

  constructor (player: videojs.Player, options: Partial<EndCardOptions> = {}) {
    const settings = {
      next: options.next,
      getTitle: options.getTitle,
      timeout: options.timeout || 5000,
      cancelText: options.cancelText || 'Cancel',
      headText: options.headText || 'Up Next',
      suspendedText: options.suspendedText || 'Autoplay is suspended',
      condition: options.condition,
      suspended: options.suspended
    }

    super(player)

    this.player.ready(() => {
      player.addClass('vjs-upnext')
    })

    player.addChild('EndCard', settings)
  }
}

videojs.registerPlugin('upnext', UpNextPlugin)
export { UpNextPlugin }
