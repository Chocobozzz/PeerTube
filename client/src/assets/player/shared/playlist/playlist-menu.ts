import videojs from 'video.js'
import { VideoPlaylistElement } from '@peertube/peertube-models'
import { PlaylistPluginOptions } from '../../types'
import { PlaylistMenuItem } from './playlist-menu-item'

const Component = videojs.getComponent('Component')

class PlaylistMenu extends Component {
  private menuItems: PlaylistMenuItem[] = []

  private readonly userInactiveHandler: () => void
  private readonly onMouseEnter: () => void
  private readonly onMouseLeave: () => void

  private readonly onPlayerCick: (event: Event) => void

  options_: PlaylistPluginOptions & videojs.ComponentOptions

  constructor (player: videojs.Player, options?: PlaylistPluginOptions & videojs.ComponentOptions) {
    super(player, options)

    this.userInactiveHandler = () => {
      this.close()
    }

    this.onMouseEnter = () => {
      this.player().off('userinactive', this.userInactiveHandler)
    }

    this.onMouseLeave = () => {
      this.player().one('userinactive', this.userInactiveHandler)
    }

    this.onPlayerCick = event => {
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
    }

    this.el().addEventListener('mouseenter', this.onMouseEnter)
    this.el().addEventListener('mouseleave', this.onMouseLeave)

    this.player().on('click', this.onPlayerCick)
  }

  dispose () {
    this.el().removeEventListener('mouseenter', this.onMouseEnter)
    this.el().removeEventListener('mouseleave', this.onMouseLeave)

    this.player().off('userinactive', this.userInactiveHandler)
    this.player().off('click', this.onPlayerCick)

    for (const item of this.menuItems) {
      item.dispose()
    }

    super.dispose()
  }

  createEl () {
    this.menuItems = []

    const menu = super.createEl('div', {
      className: 'vjs-playlist-menu',
      tabIndex: -1
    })

    const header = super.createEl('div', {
      className: 'header'
    })

    const headerLeft = super.createEl('div')

    const leftTitle = super.createEl('div', {
      innerText: this.options_.playlist.displayName,
      className: 'title'
    })

    const playlistChannel = this.options_.playlist.videoChannel
    const leftSubtitle = super.createEl('div', {
      innerText: playlistChannel
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

    for (const playlistElement of this.options_.elements) {
      const item = new PlaylistMenuItem(this.player(), {
        element: playlistElement,
        onClicked: () => this.onItemClicked(playlistElement)
      })

      list.appendChild(item.el())

      this.menuItems.push(item)
    }

    menu.appendChild(header)
    menu.appendChild(list)

    this.update()

    return menu
  }

  update () {
    this.updateSelected(this.options_.getCurrentPosition())
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

  private onItemClicked (element: VideoPlaylistElement) {
    this.options_.onItemClicked(element)
  }
}

Component.registerComponent('PlaylistMenu', PlaylistMenu)

export { PlaylistMenu }
