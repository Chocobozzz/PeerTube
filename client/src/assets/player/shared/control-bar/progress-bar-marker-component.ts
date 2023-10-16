import videojs from 'video.js'
import { ProgressBarMarkerComponentOptions } from '../../types'

const Component = videojs.getComponent('Component')

export class ProgressBarMarkerComponent extends Component {
  options_: ProgressBarMarkerComponentOptions & videojs.ComponentOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: videojs.Player, options?: ProgressBarMarkerComponentOptions & videojs.ComponentOptions) {
    super(player, options)

    const updateMarker = () => {
      (this.el() as HTMLElement).style.setProperty('left', this.buildLeftStyle())
    }
    this.player().on('durationchange', updateMarker)

    this.one('dispose', () => this.player().off('durationchange', updateMarker))
  }

  createEl () {
    return videojs.dom.createEl('span', {
      className: 'vjs-marker',
      style: `left: ${this.buildLeftStyle()}`
    }) as HTMLButtonElement
  }

  private buildLeftStyle () {
    return `${(this.options_.timecode / this.player().duration()) * 100}%`
  }
}

videojs.registerComponent('ProgressBarMarkerComponent', ProgressBarMarkerComponent)
