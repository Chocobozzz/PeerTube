import videojs from 'video.js'
import { PlaylistPluginOptions, VideojsPlayer, VideojsPlugin } from '../../types'
import { PlaylistButton } from './playlist-button'
import { PlaylistMenu } from './playlist-menu'

const Plugin = videojs.getPlugin('plugin') as typeof VideojsPlugin

class PlaylistPlugin extends Plugin {
  declare private playlistMenu: PlaylistMenu
  declare private playlistButton: PlaylistButton

  constructor (player: VideojsPlayer, options?: PlaylistPluginOptions) {
    super(player)

    this.player.addClass('vjs-playlist')

    this.playlistMenu = new PlaylistMenu(player, options)
    this.playlistButton = new PlaylistButton(player, { ...options, playlistMenu: this.playlistMenu })

    player.addChild(this.playlistMenu, options)
    player.addChild(this.playlistButton, options)
  }

  dispose () {
    this.player.removeClass('vjs-playlist')

    this.playlistMenu.dispose()
    this.playlistButton.dispose()

    this.player.removeChild(this.playlistMenu)
    this.player.removeChild(this.playlistButton)

    super.dispose()
  }
}

videojs.registerPlugin('playlist', PlaylistPlugin)
export { PlaylistPlugin }
