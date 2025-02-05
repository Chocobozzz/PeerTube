import videojs from 'video.js'
import { StatsCard, StatsCardOptions } from './stats-card'

const Plugin = videojs.getPlugin('plugin')

class StatsForNerdsPlugin extends Plugin {
  declare private statsCard: StatsCard

  constructor (player: videojs.Player, options: StatsCardOptions) {
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
