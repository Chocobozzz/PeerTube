import videojs from 'video.js'
import { UpNextPluginOptions } from '../../types'

function getMainTemplate (options: EndCardOptions) {
  return `
    <div class="vjs-upnext-top">
      <span class="vjs-upnext-headtext">${options.headText}</span>
      <div class="vjs-upnext-title"></div>
    </div>
    <div class="vjs-upnext-autoplay-icon">
      <svg height="100%" version="1.1" viewbox="0 0 98 98" width="100%">
        <circle class="vjs-upnext-svg-autoplay-circle" cx="49" cy="49" fill="#000" fill-opacity="0.8" r="48"></circle>
        <circle class="vjs-upnext-svg-autoplay-ring" cx="-49" cy="49" fill-opacity="0" r="46.5"
                stroke="#FFFFFF" stroke-width="4" transform="rotate(-90)"
        ></circle>
        <polygon class="vjs-upnext-svg-autoplay-triangle" fill="#fff" points="32,27 72,49 32,71"></polygon></svg>
    </div>
    <span class="vjs-upnext-bottom">
      <span class="vjs-upnext-cancel">
        <button class="vjs-upnext-cancel-button" tabindex="0" aria-label="Cancel autoplay">${options.cancelText}</button>
      </span>
      <span class="vjs-upnext-suspended">${options.suspendedText}</span>
    </span>
  `
}

export interface EndCardOptions extends videojs.ComponentOptions, UpNextPluginOptions {
  cancelText: string
  headText: string
  suspendedText: string
}

const Component = videojs.getComponent('Component')
export class EndCard extends Component {
  options_: EndCardOptions

  dashOffsetTotal = 586
  dashOffsetStart = 293
  interval = 50
  upNextEvents = new videojs.EventTarget()
  ticks = 0
  totalTicks: number

  container: HTMLDivElement
  title: HTMLElement
  autoplayRing: HTMLElement
  cancelButton: HTMLElement
  suspendedMessage: HTMLElement
  nextButton: HTMLElement

  private timeout: any

  private onEndedHandler: () => void
  private onPlayingHandler: () => void

  constructor (player: videojs.Player, options: EndCardOptions) {
    super(player, options)

    this.totalTicks = this.options_.timeout / this.interval

    this.onEndedHandler = () => {
      if (!this.options_.isDisplayed()) return

      player.addClass('vjs-upnext--showing')

      this.showCard(canceled => {
        player.removeClass('vjs-upnext--showing')

        this.container.style.display = 'none'

        if (!canceled) {
          this.options_.next()
        }
      })
    }

    this.onPlayingHandler = () => {
      this.upNextEvents.trigger('playing')
    }

    player.on([ 'auto-stopped', 'ended' ], this.onEndedHandler)
    player.on('playing', this.onPlayingHandler)
  }

  dispose () {
    if (this.onEndedHandler) this.player().off([ 'auto-stopped', 'ended' ], this.onEndedHandler)
    if (this.onPlayingHandler) this.player().off('playing', this.onPlayingHandler)

    if (this.timeout) clearTimeout(this.timeout)

    super.dispose()
  }

  createEl () {
    const container = super.createEl('div', {
      className: 'vjs-upnext-content',
      innerHTML: getMainTemplate(this.options_)
    }) as HTMLDivElement

    this.container = container
    container.style.display = 'none'

    this.autoplayRing = container.getElementsByClassName('vjs-upnext-svg-autoplay-ring')[0] as HTMLElement
    this.title = container.getElementsByClassName('vjs-upnext-title')[0] as HTMLElement
    this.cancelButton = container.getElementsByClassName('vjs-upnext-cancel-button')[0] as HTMLElement
    this.suspendedMessage = container.getElementsByClassName('vjs-upnext-suspended')[0] as HTMLElement
    this.nextButton = container.getElementsByClassName('vjs-upnext-autoplay-icon')[0] as HTMLElement

    this.cancelButton.onclick = () => {
      this.upNextEvents.trigger('cancel')
    }

    this.nextButton.onclick = () => {
      this.upNextEvents.trigger('next')
    }

    return container
  }

  showCard (cb: (canceled: boolean) => void) {
    this.autoplayRing.setAttribute('stroke-dasharray', `${this.dashOffsetStart}`)
    this.autoplayRing.setAttribute('stroke-dashoffset', `${-this.dashOffsetStart}`)

    this.title.innerText = this.options_.getTitle()

    if (this.totalTicks === 0) {
      return cb(false)
    }

    this.upNextEvents.one('cancel', () => {
      clearTimeout(this.timeout)
      this.timeout = undefined
      cb(true)
    })

    this.upNextEvents.one('playing', () => {
      clearTimeout(this.timeout)
      this.timeout = undefined
      cb(true)
    })

    this.upNextEvents.one('next', () => {
      clearTimeout(this.timeout)
      this.timeout = undefined
      cb(false)
    })

    const goToPercent = (percent: number) => {
      const newOffset = Math.max(-this.dashOffsetTotal, -this.dashOffsetStart - percent * this.dashOffsetTotal / 2 / 100)
      this.autoplayRing.setAttribute('stroke-dashoffset', '' + newOffset)
    }

    const tick = () => {
      goToPercent((this.ticks++) * 100 / this.totalTicks)
    }

    const update = () => {
      if (this.options_.isSuspended()) {
        this.suspendedMessage.innerText = this.options_.suspendedText
        goToPercent(0)
        this.ticks = 0
        this.timeout = setTimeout(update.bind(this), 300) // checks once supsended can be a bit longer
      } else if (this.ticks >= this.totalTicks) {
        clearTimeout(this.timeout)
        this.timeout = undefined
        cb(false)
      } else {
        this.suspendedMessage.innerText = ''
        tick()
        this.timeout = setTimeout(update.bind(this), this.interval)
      }
    }

    this.container.style.display = 'block'
    this.timeout = setTimeout(update.bind(this), this.interval)
  }
}

videojs.registerComponent('EndCard', EndCard)
