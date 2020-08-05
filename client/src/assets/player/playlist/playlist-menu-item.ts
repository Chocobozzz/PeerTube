import videojs from 'video.js'
import { VideoPlaylistElement } from '@shared/models'
import { PlaylistItemOptions } from '../peertube-videojs-typings'
import { secondsToTime } from '../utils'

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

    if (!options.element.video) {
      li.classList.add('vjs-disabled')
    }

    const positionBlock = super.createEl('div', {
      className: 'item-position-block'
    }) as HTMLElement

    const position = super.createEl('div', {
      className: 'item-position',
      innerHTML: options.element.position
    })

    positionBlock.appendChild(position)
    li.appendChild(positionBlock)

    if (options.element.video) {
      this.buildAvailableVideo(li, positionBlock, options)
    } else {
      this.buildUnavailableVideo(li)
    }

    return li
  }

  setSelected (selected: boolean) {
    if (selected) this.addClass('vjs-selected')
    else this.removeClass('vjs-selected')
  }

  getElement () {
    return this.element
  }

  private buildAvailableVideo (li: HTMLElement, positionBlock: HTMLElement, options: PlaylistItemOptions) {
    const videoElement = options.element

    const player = super.createEl('div', {
      className: 'item-player'
    })

    positionBlock.appendChild(player)

    const thumbnail = super.createEl('img', {
      src: window.location.origin + videoElement.video.thumbnailPath
    })

    const infoBlock = super.createEl('div', {
      className: 'info-block'
    })

    const title = super.createEl('div', {
      innerHTML: videoElement.video.name,
      className: 'title'
    })

    const channel = super.createEl('div', {
      innerHTML: videoElement.video.channel.displayName,
      className: 'channel'
    })

    infoBlock.appendChild(title)
    infoBlock.appendChild(channel)

    if (videoElement.startTimestamp || videoElement.stopTimestamp) {
      let html = ''

      if (videoElement.startTimestamp) html += secondsToTime(videoElement.startTimestamp)
      if (videoElement.stopTimestamp) html += ' - ' + secondsToTime(videoElement.stopTimestamp)

      const timestamps = super.createEl('div', {
        innerHTML: html,
        className: 'timestamps'
      })

      infoBlock.append(timestamps)
    }

    li.append(thumbnail)
    li.append(infoBlock)
  }

  private buildUnavailableVideo (li: HTMLElement) {
    const block = super.createEl('div', {
      className: 'item-unavailable',
      innerHTML: this.player().localize('Unavailable video')
    })

    li.appendChild(block)
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
