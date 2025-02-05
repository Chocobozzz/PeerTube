import videojs from 'video.js'
import { ProgressBarMarkerComponentOptions } from '../../types'

const ClickableComponent = videojs.getComponent('ClickableComponent')

export class ProgressBarMarkerComponent extends ClickableComponent {
  declare options_: ProgressBarMarkerComponentOptions & videojs.ComponentOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: videojs.Player, options?: ProgressBarMarkerComponentOptions & videojs.ComponentOptions) {
    super(player, options)

    const updateMarker = () => {
      if (!this.hasValidDuration()) return

      const el = this.el() as HTMLElement

      el.style.setProperty('left', this.buildLeftStyle())
      el.style.setProperty('display', 'inline')
    }
    this.player().on('durationchange', updateMarker)

    const stopPropagation = (event: Event) => event.stopPropagation()

    this.on([ 'mousedown', 'touchstart' ], stopPropagation)

    this.one('dispose', () => {
      if (this.player()) this.player().off('durationchange', updateMarker)

      if (this.el()) {
        this.off([ 'mousedown', 'touchstart' ], stopPropagation)
      }
    })
  }

  createEl () {
    return videojs.dom.createEl('span', {
      className: 'vjs-chapter-marker',
      style: this.hasValidDuration()
        ? `left: ${this.buildLeftStyle()}`
        : 'display: none;'
    }) as HTMLButtonElement
  }

  handleClick (event: Event) {
    event.stopPropagation()

    if (this.player()) this.player().currentTime(this.options_.timecode)
  }

  private buildLeftStyle () {
    return `${(this.options_.timecode / this.player().duration()) * 100}%`
  }

  private hasValidDuration () {
    const duration = this.player().duration()

    if (isNaN(duration) || !duration) return false

    return true
  }
}

videojs.registerComponent('ProgressBarMarkerComponent', ProgressBarMarkerComponent)
