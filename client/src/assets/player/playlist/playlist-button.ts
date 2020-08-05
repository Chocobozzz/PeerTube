import videojs from 'video.js'
import { PlaylistPluginOptions } from '../peertube-videojs-typings'
import { PlaylistMenu } from './playlist-menu'

const ClickableComponent = videojs.getComponent('ClickableComponent')

class PlaylistButton extends ClickableComponent {
  private playlistInfoElement: HTMLElement
  private wrapper: HTMLElement

  constructor (player: videojs.Player, options?: PlaylistPluginOptions & { playlistMenu: PlaylistMenu }) {
    super(player, options as any)
  }

  createEl () {
    this.wrapper = super.createEl('div', {
      className: 'vjs-playlist-button',
      innerHTML: '',
      tabIndex: -1
    }) as HTMLElement

    const icon = super.createEl('div', {
      className: 'vjs-playlist-icon',
      innerHTML: '',
      tabIndex: -1
    })

    this.playlistInfoElement = super.createEl('div', {
      className: 'vjs-playlist-info',
      innerHTML: '',
      tabIndex: -1
    }) as HTMLElement

    this.wrapper.appendChild(icon)
    this.wrapper.appendChild(this.playlistInfoElement)

    this.update()

    return this.wrapper
  }

  update () {
    const options = this.options_ as PlaylistPluginOptions

    this.playlistInfoElement.innerHTML = options.getCurrentPosition() + '/' + options.playlist.videosLength
    this.wrapper.title = this.player().localize('Playlist: {1}', [ options.playlist.displayName ])
  }

  handleClick () {
    const playlistMenu = this.getPlaylistMenu()
    playlistMenu.open()
  }

  private getPlaylistMenu () {
    return (this.options_ as any).playlistMenu as PlaylistMenu
  }
}

videojs.registerComponent('PlaylistButton', PlaylistButton)

export { PlaylistButton }
