import videojs from 'video.js'
import { VideojsPlayer, VideojsPlugin } from '../../types'
import { StatsCard, StatsCardOptions } from './stats-card'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

class StatsForNerdsPlugin extends Plugin {
  declare private statsCard: StatsCard

  constructor (player: VideojsPlayer, options: StatsCardOptions) {
    super(player)

    this.player.ready(() => {
      player.addClass('vjs-stats-for-nerds')
    })

    this.statsCard = new StatsCard(player, options)

    // Copy options
    player.addChild(this.statsCard)
  }

  dispose () {
    if (this.statsCard) {
      this.statsCard.dispose()
      this.player.removeChild(this.statsCard)
    }

    super.dispose()
  }

  show () {
    this.statsCard.show()
  }
}

videojs.registerPlugin('stats', StatsForNerdsPlugin)
export { StatsForNerdsPlugin }
