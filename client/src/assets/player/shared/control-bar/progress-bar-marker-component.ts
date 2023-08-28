import videojs from 'video.js'
import { ProgressBarMarkerComponentOptions } from '../../types'

const Component = videojs.getComponent('Component')

export class ProgressBarMarkerComponent extends Component {
  options_: ProgressBarMarkerComponentOptions & videojs.ComponentOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: videojs.Player, options?: ProgressBarMarkerComponentOptions & videojs.ComponentOptions) {
    super(player, options)
  }

  createEl () {
    const left = (this.options_.timecode / this.player().duration()) * 100

    return videojs.dom.createEl('span', {
      className: 'vjs-marker',
      style: `left: ${left}%`
    }) as HTMLButtonElement
  }
}

videojs.registerComponent('ProgressBarMarkerComponent', ProgressBarMarkerComponent)
