import videojs from 'video.js'
import { PauseBezel } from './pause-bezel'

const Plugin = videojs.getPlugin('plugin')

class BezelsPlugin extends Plugin {

  constructor (player: videojs.Player, options?: videojs.ComponentOptions) {
    super(player)

    this.player.ready(() => {
      player.addClass('vjs-bezels')
    })

    const component = new PauseBezel(player, options)
    player.addChild(component)

    this.on('dispose', () => player.removeChild(component))
  }
}

videojs.registerPlugin('bezels', BezelsPlugin)

export { BezelsPlugin }
