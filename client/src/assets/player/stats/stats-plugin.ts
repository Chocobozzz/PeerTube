import videojs from 'video.js'
import { StatsCard, StatsCardOptions } from './stats-card'

const Plugin = videojs.getPlugin('plugin')

class StatsForNerdsPlugin extends Plugin {
  private statsCard: StatsCard

  constructor (player: videojs.Player, options: Partial<StatsCardOptions> = {}) {
    const settings = {
      ...options
    }

    super(player)

    this.player.ready(() => {
      player.addClass('vjs-stats-for-nerds')
    })

    this.statsCard = new StatsCard(player, options)

    player.addChild(this.statsCard, settings)
  }

  show (options?: StatsCardOptions) {
    this.statsCard.show(options)
  }
}

videojs.registerPlugin('stats', StatsForNerdsPlugin)
export { StatsForNerdsPlugin }
