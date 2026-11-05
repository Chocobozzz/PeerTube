import videojs from 'video.js'
import { VideojsComponent, VideojsComponentOptions, VideojsPlayer } from '../../types'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

export type PeerTubeCommercialContentInfoComponentOptions = {
  label: string
}

class PeerTubeCommercialContentInfoComponent extends Component {
  declare options_: VideojsComponentOptions & PeerTubeCommercialContentInfoComponentOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: VideojsPlayer, options: VideojsComponentOptions & PeerTubeCommercialContentInfoComponentOptions) {
    super(player, options)
  }

  createEl () {
    return super.createEl('div', { className: 'commercial-content-info', textContent: this.options_.label })
  }
}

videojs.registerComponent('PeerTubeCommercialContentInfoComponent', PeerTubeCommercialContentInfoComponent)

export {
  PeerTubeCommercialContentInfoComponent
}
