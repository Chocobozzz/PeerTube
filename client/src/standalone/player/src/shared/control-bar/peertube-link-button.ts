import { buildVideoLink, decorateVideoLink } from '@peertube/peertube-core-utils'
import videojs from 'video.js'
import { PeerTubeLinkButtonOptions, VideojsComponent, VideojsComponentOptions, VideojsPlayer } from '../../types'

const Component = videojs.getComponent('Component') as typeof VideojsComponent

class PeerTubeLinkButton extends Component {
  declare private mouseEnterHandler: () => void
  declare private clickHandler: () => void

  declare options_: PeerTubeLinkButtonOptions & VideojsComponentOptions

  constructor (player: VideojsPlayer, options?: PeerTubeLinkButtonOptions & VideojsComponentOptions) {
    super(player, options)

    this.updateShowing()
    this.player().on('video-change', () => this.updateShowing())
  }

  dispose () {
    if (this.el()) return

    this.el().removeEventListener('mouseenter', this.mouseEnterHandler)
    this.el().removeEventListener('click', this.clickHandler)

    super.dispose()
  }

  createEl () {
    const el = videojs.dom.createEl('a', {
      href: this.buildLink(),
      innerText: this.options_.instanceName,
      title: this.player().localize('Video page (new window)'),
      className: 'vjs-peertube-link',
      target: '_blank'
    })

    this.mouseEnterHandler = () => this.updateHref()
    this.clickHandler = () => this.player().pause()

    el.addEventListener('mouseenter', this.mouseEnterHandler)
    el.addEventListener('click', this.clickHandler)

    return el
  }

  updateShowing () {
    if (this.options_.isDisplayed()) this.show()
    else this.hide()
  }

  updateHref () {
    this.el().setAttribute('href', this.buildLink())
  }

  private buildLink () {
    const url = buildVideoLink({ shortUUID: this.options_.shortUUID() })

    return decorateVideoLink({ url, startTime: this.player().currentTime() })
  }
}

videojs.registerComponent('PeerTubeLinkButton', PeerTubeLinkButton)
