import videojs from 'video.js'
import { PlaylistPluginOptions } from '../peertube-videojs-typings'
import { PlaylistButton } from './playlist-button'
import { PlaylistMenu } from './playlist-menu'

const Plugin = videojs.getPlugin('plugin')

class PlaylistPlugin extends Plugin {
  private playlistMenu: PlaylistMenu
  private playlistButton: PlaylistButton
  private options: PlaylistPluginOptions

  constructor (player: videojs.Player, options?: PlaylistPluginOptions) {
    super(player, options)

    this.options = options

    this.player.ready(() => {
      player.addClass('vjs-playlist')
    })

    this.playlistMenu = new PlaylistMenu(player, options)
    this.playlistButton = new PlaylistButton(player, Object.assign({}, options, { playlistMenu: this.playlistMenu }))

    player.addChild(this.playlistMenu, options)
    player.addChild(this.playlistButton, options)
  }

  updateSelected () {
    this.playlistMenu.updateSelected(this.options.getCurrentPosition())
  }
}

videojs.registerPlugin('playlist', PlaylistPlugin)
export { PlaylistPlugin }
