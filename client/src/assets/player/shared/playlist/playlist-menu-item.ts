import videojs from 'video.js'
import { secondsToTime } from '@peertube/peertube-core-utils'
import { VideoPlaylistElement } from '@peertube/peertube-models'
import { PlaylistItemOptions } from '../../types'

const Component = videojs.getComponent('Component')

class PlaylistMenuItem extends Component {
  private element: VideoPlaylistElement

  private clickHandler: () => void
  private keyDownHandler: (event: KeyboardEvent) => void

  options_: videojs.ComponentOptions & PlaylistItemOptions

  constructor (player: videojs.Player, options?: PlaylistItemOptions) {
    super(player, options as any)

    this.emitTapEvents()

    this.element = options.element

    this.clickHandler = () => this.switchPlaylistItem()
    this.keyDownHandler = event => this.handleKeyDown(event)

    this.on([ 'click', 'tap' ], this.clickHandler)
    this.on('keydown', this.keyDownHandler)
  }

  dispose () {
    this.off([ 'click', 'tap' ], this.clickHandler)
    this.off('keydown', this.keyDownHandler)

    super.dispose()
  }

  createEl () {
    const li = super.createEl('li', {
      className: 'vjs-playlist-menu-item'
    }) as HTMLElement

    if (!this.options_.element.video) {
      li.classList.add('vjs-disabled')
    }

    const positionBlock = super.createEl('div', {
      className: 'item-position-block'
    }) as HTMLElement

    const position = super.createEl('div', {
      className: 'item-position',
      innerText: this.options_.element.position
    })

    positionBlock.appendChild(position)
    li.appendChild(positionBlock)

    if (this.options_.element.video) {
      this.buildAvailableVideo(li, positionBlock, this.options_)
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
      innerText: videoElement.video.name,
      className: 'title'
    })

    const channel = super.createEl('div', {
      innerText: videoElement.video.channel.displayName,
      className: 'channel'
    })

    infoBlock.appendChild(title)
    infoBlock.appendChild(channel)

    if (videoElement.startTimestamp || videoElement.stopTimestamp) {
      let html = ''

      if (videoElement.startTimestamp) html += secondsToTime(videoElement.startTimestamp)
      if (videoElement.stopTimestamp) html += ' - ' + secondsToTime(videoElement.stopTimestamp)

      const timestamps = super.createEl('div', {
        innerText: html,
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
      innerText: this.player().localize('Unavailable video')
    })

    li.appendChild(block)
  }

  private handleKeyDown (event: KeyboardEvent) {
    if (event.code === 'Space' || event.code === 'Enter') {
      this.switchPlaylistItem()
    }
  }

  private switchPlaylistItem () {
    this.options_.onClicked()
  }
}

Component.registerComponent('PlaylistMenuItem', PlaylistMenuItem)

export { PlaylistMenuItem }
