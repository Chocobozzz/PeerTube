import videojs from 'video.js'
import { PlaylistPluginOptions } from '../../types'
import { PlaylistMenu } from './playlist-menu'

const ClickableComponent = videojs.getComponent('ClickableComponent')

class PlaylistButton extends ClickableComponent {
  private playlistInfoElement: HTMLElement
  private wrapper: HTMLElement

  options_: PlaylistPluginOptions & { playlistMenu: PlaylistMenu } & videojs.ClickableComponentOptions

  // FIXME: eslint -> it's not a useless constructor, we need to extend constructor options typings
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (
    player: videojs.Player,
    options?: PlaylistPluginOptions & { playlistMenu: PlaylistMenu } & videojs.ClickableComponentOptions
  ) {
    super(player, options)
  }

  createEl () {
    this.wrapper = super.createEl('div', {
      className: 'vjs-playlist-button',
      tabIndex: -1
    }) as HTMLElement

    const icon = super.createEl('div', {
      className: 'vjs-playlist-icon',
      tabIndex: -1
    })

    this.playlistInfoElement = super.createEl('div', {
      className: 'vjs-playlist-info',
      tabIndex: -1
    }) as HTMLElement

    this.wrapper.appendChild(icon)
    this.wrapper.appendChild(this.playlistInfoElement)

    this.update()

    return this.wrapper
  }

  update () {
    this.playlistInfoElement.innerText = this.options_.getCurrentPosition() + '/' + this.options_.playlist.videosLength

    this.wrapper.title = this.player().localize('Playlist: {1}', [ this.options_.playlist.displayName ])
  }

  handleClick () {
    const playlistMenu = this.options_.playlistMenu
    playlistMenu.open()
  }
}

videojs.registerComponent('PlaylistButton', PlaylistButton)

export { PlaylistButton }
