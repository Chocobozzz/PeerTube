import videojs from 'video.js'
import { VideojsComponent, VideojsPlayer } from '../../types'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

class PeerTubeTopBarComponent extends Component {
  declare private itemsEl: HTMLElement

  createEl () {
    const el = super.createEl('div', { className: 'peertube-top-bar' })

    this.itemsEl = super.createEl('div', { className: 'peertube-top-bar-items' }) as HTMLElement
    el.appendChild(this.itemsEl)

    return el
  }

  addItem (component: VideojsComponent) {
    this.itemsEl.appendChild(component.el())
  }

  setEndItem (component: VideojsComponent) {
    this.el().appendChild(component.el())
  }
}

videojs.registerComponent('PeerTubeTopBarComponent', PeerTubeTopBarComponent)

function getPlayerTopBar (player: VideojsPlayer) {
  const existing = player.getChild('PeerTubeTopBarComponent') as PeerTubeTopBarComponent
  if (existing) return existing

  return player.addChild('PeerTubeTopBarComponent') as PeerTubeTopBarComponent
}

export {
  getPlayerTopBar,
  PeerTubeTopBarComponent
}
