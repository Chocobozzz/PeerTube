import videojs from 'video.js'
import { VideojsComponent, VideojsComponentOptions, VideojsPlayer } from '../../types'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

export type PeerTubeDockComponentOptions = {
  title?: string
  description?: string
  avatarUrl?: string
}

class PeerTubeDockComponent extends Component {
  declare options_: VideojsComponentOptions & PeerTubeDockComponentOptions

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor (player: VideojsPlayer, options: VideojsComponentOptions & PeerTubeDockComponentOptions) {
    super(player, options)
  }

  createEl () {
    const el = super.createEl('div', { className: 'peertube-dock' })

    if (this.options_.avatarUrl) {
      const avatar = videojs.dom.createEl('img', {
        className: 'peertube-dock-avatar',
        src: this.options_.avatarUrl
      }, { alt: '' })

      el.appendChild(avatar)
    }

    const elWrapperTitleDescription = super.createEl('div', {
      className: 'peertube-dock-title-description'
    })

    if (this.options_.title) {
      const title = videojs.dom.createEl('h2', {
        className: 'peertube-dock-title',
        title: this.options_.title,
        innerText: this.options_.title
      })

      elWrapperTitleDescription.appendChild(title)
    }

    if (this.options_.description) {
      const description = videojs.dom.createEl('div', {
        className: 'peertube-dock-description',
        title: this.options_.description,
        innerText: this.options_.description
      })

      elWrapperTitleDescription.appendChild(description)
    }

    if (this.options_.title || this.options_.description) {
      el.appendChild(elWrapperTitleDescription)
    }

    return el
  }
}

videojs.registerComponent('PeerTubeDockComponent', PeerTubeDockComponent)

export {
  PeerTubeDockComponent
}
