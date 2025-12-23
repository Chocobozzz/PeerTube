import videojs from 'video.js'
import { PlaylistPluginOptions, VideojsClickableComponent, VideojsClickableComponentOptions, VideojsPlayer } from '../../types'
import { PlaylistMenu } from './playlist-menu'

const ClickableComponent = videojs.getComponent('ClickableComponent') as typeof VideojsClickableComponent

class PlaylistButton extends ClickableComponent {
  declare private playlistInfoElement: HTMLElement
  declare private wrapper: HTMLElement

  declare options_: PlaylistPluginOptions & { playlistMenu: PlaylistMenu } & VideojsClickableComponentOptions

  // FIXME: eslint -> it's not a useless constructor, we need to extend constructor options typings
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (
    player: VideojsPlayer,
    options?: PlaylistPluginOptions & { playlistMenu: PlaylistMenu } & VideojsClickableComponentOptions
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
