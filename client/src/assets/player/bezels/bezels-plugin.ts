import videojs from 'video.js/dist/alt/video.core.js'
import './pause-bezel'

const Plugin = videojs.getPlugin('plugin')

class BezelsPlugin extends Plugin {

  constructor (player: videojs.Player, options?: videojs.ComponentOptions) {
    super(player)

    this.player.ready(() => {
      player.addClass('vjs-bezels')
    })

    player.addChild('PauseBezel', options)
  }
}

videojs.registerPlugin('bezels', BezelsPlugin)

export { BezelsPlugin }
