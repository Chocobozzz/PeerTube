// @ts-ignore
import * as videojs from 'video.js'
import { VideoJSComponentInterface } from '../peertube-videojs-typings'

function getMainTemplate (options: any) {
  return `
    <div class="vjs-upnext-top">
      <span class="vjs-upnext-headtext">${options.headText}</span>
      <div class="vjs-upnext-title"></div>
    </div>
    <div class="vjs-upnext-autoplay-icon">
      <svg height="100%" version="1.1" viewbox="0 0 98 98" width="100%">
        <circle class="vjs-upnext-svg-autoplay-circle" cx="49" cy="49" fill="#000" fill-opacity="0.8" r="48"></circle>
        <circle class="vjs-upnext-svg-autoplay-ring" cx="-49" cy="49" fill-opacity="0" r="46.5" stroke="#FFFFFF" stroke-width="4" transform="rotate(-90)"></circle>
        <polygon class="vjs-upnext-svg-autoplay-triangle" fill="#fff" points="32,27 72,49 32,71"></polygon></svg>
    </div>
    <span class="vjs-upnext-bottom">
      <span class="vjs-upnext-cancel">
        <button class="vjs-upnext-cancel-button" tabindex="0" aria-label="Cancel autoplay">${options.cancelText}</button>
      </span>
    </span>
  `
}

// @ts-ignore-start
const Component = videojs.getComponent('Component')
class EndCard extends Component {
  options_: any
  getTitle: Function
  next: Function
  condition: Function
  dashOffsetTotal = 586
  dashOffsetStart = 293
  interval = 50
  upNextEvents = new videojs.EventTarget()
  chunkSize: number

  container: HTMLElement
  title: HTMLElement
  autoplayRing: HTMLElement
  cancelButton: HTMLElement
  nextButton: HTMLElement

  constructor (player: videojs.Player, options: any) {
    super(player, options)
    this.options_ = options

    this.getTitle = this.options_.getTitle
    this.next = this.options_.next
    this.condition = this.options_.condition

    this.chunkSize = (this.dashOffsetTotal - this.dashOffsetStart) / (this.options_.timeout / this.interval)

    player.on('ended', (_: any) => {
      if (!this.condition()) return

      player.addClass('vjs-upnext--showing')
      this.showCard((canceled: boolean) => {
        player.removeClass('vjs-upnext--showing')
        this.container.style.display = 'none'
        if (!canceled) {
          this.next()
        }
      })
    })

    player.on('playing', () => {
      this.upNextEvents.trigger('playing')
    })
  }

  createEl () {
    const container = super.createEl('div', {
      className: 'vjs-upnext-content',
      innerHTML: getMainTemplate(this.options_)
    })

    this.container = container
    container.style.display = 'none'

    this.autoplayRing = container.getElementsByClassName('vjs-upnext-svg-autoplay-ring')[0]
    this.title = container.getElementsByClassName('vjs-upnext-title')[0]
    this.cancelButton = container.getElementsByClassName('vjs-upnext-cancel-button')[0]
    this.nextButton = container.getElementsByClassName('vjs-upnext-autoplay-icon')[0]

    this.cancelButton.onclick = () => {
      this.upNextEvents.trigger('cancel')
    }

    this.nextButton.onclick = () => {
      this.upNextEvents.trigger('next')
    }

    return container
  }

  showCard (cb: Function) {
    let timeout: any
    let start: number
    let now: number
    let newOffset: number

    this.autoplayRing.setAttribute('stroke-dasharray', '' + this.dashOffsetStart)
    this.autoplayRing.setAttribute('stroke-dashoffset', '' + -this.dashOffsetStart)

    this.title.innerHTML = this.getTitle()

    this.upNextEvents.one('cancel', () => {
      clearTimeout(timeout)
      cb(true)
    })

    this.upNextEvents.one('playing', () => {
      clearTimeout(timeout)
      cb(true)
    })

    this.upNextEvents.one('next', () => {
      clearTimeout(timeout)
      cb(false)
    })

    const update = () => {
      now = this.options_.timeout - (new Date().getTime() - start)

      if (now <= 0) {
        clearTimeout(timeout)
        cb(false)
      } else {
        const strokeDashOffset = parseInt(this.autoplayRing.getAttribute('stroke-dashoffset'), 10)
        newOffset = Math.max(-this.dashOffsetTotal, strokeDashOffset - this.chunkSize)
        this.autoplayRing.setAttribute('stroke-dashoffset', '' + newOffset)
        timeout = setTimeout(update.bind(this), this.interval)
      }

    }

    this.container.style.display = 'block'
    start = new Date().getTime()
    timeout = setTimeout(update.bind(this), this.interval)
  }
}
// @ts-ignore-end

videojs.registerComponent('EndCard', EndCard)

const Plugin: VideoJSComponentInterface = videojs.getPlugin('plugin')
class UpNextPlugin extends Plugin {
  constructor (player: videojs.Player, options: any = {}) {
    const settings = {
      next: options.next,
      getTitle: options.getTitle,
      timeout: options.timeout || 5000,
      cancelText: options.cancelText || 'Cancel',
      headText: options.headText || 'Up Next',
      condition: options.condition
    }

    super(player, settings)

    this.player.ready(() => {
      player.addClass('vjs-upnext')
    })

    player.addChild('EndCard', settings)
  }
}

videojs.registerPlugin('upnext', UpNextPlugin)
export { UpNextPlugin }
