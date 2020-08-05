import videojs from 'video.js'
import { VideoPlaylistElement } from '@shared/models'
import { PlaylistItemOptions } from '../peertube-videojs-typings'

const Component = videojs.getComponent('Component')

class PlaylistMenuItem extends Component {
  private element: VideoPlaylistElement

  constructor (player: videojs.Player, options?: PlaylistItemOptions) {
    super(player, options as any)

    this.emitTapEvents()

    this.element = options.element

    this.on([ 'click', 'tap' ], () => this.switchPlaylistItem())
    this.on('keydown', event => this.handleKeyDown(event))
  }

  createEl () {
    const options = this.options_ as PlaylistItemOptions

    const li = super.createEl('li', {
      className: 'vjs-playlist-menu-item',
      innerHTML: ''
    }) as HTMLElement

    const positionBlock = super.createEl('div', {
      className: 'item-position-block'
    })

    const position = super.createEl('div', {
      className: 'item-position',
      innerHTML: options.element.position
    })

    const player = super.createEl('div', {
      className: 'item-player'
    })

    positionBlock.appendChild(position)
    positionBlock.appendChild(player)

    li.appendChild(positionBlock)

    const thumbnail = super.createEl('img', {
      src: window.location.origin + options.element.video.thumbnailPath
    })

    const infoBlock = super.createEl('div', {
      className: 'info-block'
    })

    const title = super.createEl('div', {
      innerHTML: options.element.video.name,
      className: 'title'
    })

    const channel = super.createEl('div', {
      innerHTML: options.element.video.channel.displayName,
      className: 'channel'
    })

    infoBlock.appendChild(title)
    infoBlock.appendChild(channel)

    li.append(thumbnail)
    li.append(infoBlock)

    return li
  }

  setSelected (selected: boolean) {
    if (selected) this.addClass('vjs-selected')
    else this.removeClass('vjs-selected')
  }

  getElement () {
    return this.element
  }

  private handleKeyDown (event: KeyboardEvent) {
    if (event.code === 'Space' || event.code === 'Enter') {
      this.switchPlaylistItem()
    }
  }

  private switchPlaylistItem () {
    const options = this.options_ as PlaylistItemOptions

    options.onClicked()
  }
}

Component.registerComponent('PlaylistMenuItem', PlaylistMenuItem)

export { PlaylistMenuItem }
