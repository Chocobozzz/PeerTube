import videojs from 'video.js'
import { VideoPlaylistElement } from '@shared/models'
import { PlaylistPluginOptions } from '../peertube-videojs-typings'
import { PlaylistMenuItem } from './playlist-menu-item'

const Component = videojs.getComponent('Component')

class PlaylistMenu extends Component {
  private menuItems: PlaylistMenuItem[]

  constructor (player: videojs.Player, options?: PlaylistPluginOptions) {
    super(player, options as any)

    const self = this

    function userInactiveHandler () {
      self.close()
    }

    this.el().addEventListener('mouseenter', () => {
      this.player().off('userinactive', userInactiveHandler)
    })

    this.el().addEventListener('mouseleave', () => {
      this.player().one('userinactive', userInactiveHandler)
    })

    this.player().on('click', event => {
      let current = event.target as HTMLElement

      do {
        if (
          current.classList.contains('vjs-playlist-menu') ||
          current.classList.contains('vjs-playlist-button')
        ) {
          return
        }

        current = current.parentElement
      } while (current)

      this.close()
    })
  }

  createEl () {
    this.menuItems = []

    const options = this.getOptions()

    const menu = super.createEl('div', {
      className: 'vjs-playlist-menu',
      innerHTML: '',
      tabIndex: -1
    })

    const header = super.createEl('div', {
      className: 'header'
    })

    const headerLeft = super.createEl('div')

    const leftTitle = super.createEl('div', {
      innerHTML: options.playlist.displayName,
      className: 'title'
    })

    const playlistChannel = options.playlist.videoChannel
    const leftSubtitle = super.createEl('div', {
      innerHTML: playlistChannel
        ? this.player().localize('By {1}', [ playlistChannel.displayName ])
        : '',
      className: 'channel'
    })

    headerLeft.appendChild(leftTitle)
    headerLeft.appendChild(leftSubtitle)

    const tick = super.createEl('div', {
      className: 'cross'
    })
    tick.addEventListener('click', () => this.close())

    header.appendChild(headerLeft)
    header.appendChild(tick)

    const list = super.createEl('ol')

    for (const playlistElement of options.elements) {
      const item = new PlaylistMenuItem(this.player(), {
        element: playlistElement,
        onClicked: () => this.onItemClicked(playlistElement)
      })

      list.appendChild(item.el())

      this.menuItems.push(item)
    }

    menu.appendChild(header)
    menu.appendChild(list)

    return menu
  }

  update () {
    const options = this.getOptions()

    this.updateSelected(options.getCurrentPosition())
  }

  open () {
    this.player().addClass('playlist-menu-displayed')
  }

  close () {
    this.player().removeClass('playlist-menu-displayed')
  }

  updateSelected (newPosition: number) {
    for (const item of this.menuItems) {
      item.setSelected(item.getElement().position === newPosition)
    }
  }

  private getOptions () {
    return this.options_ as PlaylistPluginOptions
  }

  private onItemClicked (element: VideoPlaylistElement) {
    this.getOptions().onItemClicked(element)
  }
}

Component.registerComponent('PlaylistMenu', PlaylistMenu)

export { PlaylistMenu }
