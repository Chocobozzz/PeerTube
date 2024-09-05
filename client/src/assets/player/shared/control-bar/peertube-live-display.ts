import videojs from 'video.js'
import { PeerTubeLinkButtonOptions } from '../../types'

const ClickableComponent = videojs.getComponent('ClickableComponent')

class PeerTubeLiveDisplay extends ClickableComponent {
  declare private interval: any

  declare private contentEl_: any

  constructor (player: videojs.Player, options?: PeerTubeLinkButtonOptions) {
    super(player, options as any)

    this.interval = this.setInterval(() => this.updateClass(), 1000)

    this.updateSync(true)
  }

  dispose () {
    if (this.interval) {
      this.clearInterval(this.interval)
      this.interval = undefined
    }

    this.contentEl_ = null

    super.dispose()
  }

  createEl () {
    const el = super.createEl('div', {
      className: 'vjs-pt-live-control vjs-control'
    })

    this.contentEl_ = videojs.dom.createEl('div', {
      className: 'vjs-live-display'
    }, {
      'aria-live': 'off'
    })

    this.contentEl_.appendChild(videojs.dom.createEl('span', {
      className: 'vjs-control-text',
      textContent: `${this.localize('Stream Type')}\u00a0`
    }))

    this.contentEl_.appendChild(document.createTextNode(this.localize('LIVE')))

    el.appendChild(this.contentEl_)
    return el
  }

  handleClick () {
    const hlsjs = this.getHLSJS()
    if (!hlsjs) return

    this.player().currentTime(hlsjs.liveSyncPosition)
    this.player().play()
    this.updateSync(true)
  }

  private updateClass () {
    const hlsjs = this.getHLSJS()
    if (!hlsjs) return

    // Not loaded yet
    if (this.player().currentTime() === 0) return

    const isSync = Math.abs(this.player().currentTime() - hlsjs.liveSyncPosition) < 10
    this.updateSync(isSync)
  }

  private updateSync (isSync: boolean) {
    if (isSync) {
      this.addClass('synced-with-live-edge')
      this.removeAttribute('title')
      this.disable()
    } else {
      this.removeClass('synced-with-live-edge')
      this.setAttribute('title', this.localize('Go back to the live'))
      this.enable()
    }
  }

  private getHLSJS () {
    if (!this.player()?.usingPlugin('p2pMediaLoader')) return

    return this.player().p2pMediaLoader().getHLSJS()
  }
}

videojs.registerComponent('PeerTubeLiveDisplay', PeerTubeLiveDisplay)
