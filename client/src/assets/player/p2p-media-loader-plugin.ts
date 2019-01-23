// FIXME: something weird with our path definition in tsconfig and typings
// @ts-ignore
import * as videojs from 'video.js'
import { P2PMediaLoaderPluginOptions, VideoJSComponentInterface } from './peertube-videojs-typings'

// videojs-hlsjs-plugin needs videojs in window
window['videojs'] = videojs
import '@streamroot/videojs-hlsjs-plugin'

import { initVideoJsContribHlsJsPlayer } from 'p2p-media-loader-hlsjs'

// import { Events } from '../p2p-media-loader/p2p-media-loader-core/lib'

const Plugin: VideoJSComponentInterface = videojs.getPlugin('plugin')
class P2pMediaLoaderPlugin extends Plugin {

  constructor (player: videojs.Player, options: P2PMediaLoaderPluginOptions) {
    super(player, options)

    initVideoJsContribHlsJsPlayer(player)

    console.log(options)

    player.src({
      type: options.type,
      src: options.src
    })
  }

}

videojs.registerPlugin('p2pMediaLoader', P2pMediaLoaderPlugin)
export { P2pMediaLoaderPlugin }
