import videojs from 'video.js'
import { ProgressBarMarkerComponentOptions, VideojsClickableComponent, VideojsClickableComponentOptions, VideojsPlayer } from '../../types'

const ClickableComponent = videojs.getComponent('ClickableComponent') as typeof VideojsClickableComponent

export class ProgressBarMarkerComponent extends ClickableComponent {
  declare options_: ProgressBarMarkerComponentOptions & VideojsClickableComponentOptions

  constructor (player: VideojsPlayer, options?: ProgressBarMarkerComponentOptions & VideojsClickableComponentOptions) {
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
