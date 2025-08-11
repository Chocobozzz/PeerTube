import videojs from 'video.js'
import type { VideojsComponentOptions, VideojsPlayer, VideojsPlugin } from '../../types/peertube-videojs-typings'
import { PauseBezel } from './pause-bezel'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

class BezelsPlugin extends Plugin {
  constructor (player: VideojsPlayer, options?: VideojsComponentOptions) {
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
