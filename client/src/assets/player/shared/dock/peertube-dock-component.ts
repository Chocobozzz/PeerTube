import videojs from 'video.js'

const Component = videojs.getComponent('Component')

export type PeerTubeDockComponentOptions = {
  title?: string
  description?: string
  avatarUrl?: string
}

class PeerTubeDockComponent extends Component {

  createEl () {
    const options = this.options_ as PeerTubeDockComponentOptions

    const el = super.createEl('div', {
      className: 'peertube-dock'
    })

    if (options.avatarUrl) {
      const avatar = videojs.dom.createEl('img', {
        className: 'peertube-dock-avatar',
        src: options.avatarUrl
      })

      el.appendChild(avatar)
    }

    const elWrapperTitleDescription = super.createEl('div', {
      className: 'peertube-dock-title-description'
    })

    if (options.title) {
      const title = videojs.dom.createEl('div', {
        className: 'peertube-dock-title',
        title: options.title,
        innerHTML: options.title
      })

      elWrapperTitleDescription.appendChild(title)
    }

    if (options.description) {
      const description = videojs.dom.createEl('div', {
        className: 'peertube-dock-description',
        title: options.description,
        innerHTML: options.description
      })

      elWrapperTitleDescription.appendChild(description)
    }

    if (options.title || options.description) {
      el.appendChild(elWrapperTitleDescription)
    }

    return el
  }
}

videojs.registerComponent('PeerTubeDockComponent', PeerTubeDockComponent)

export {
  PeerTubeDockComponent
}
