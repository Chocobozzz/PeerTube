import videojs from 'video.js'
import { PopoutButtonOptions, VideojsButton, VideojsButtonOptions, VideojsPlayer } from '../../types'

const Button = videojs.getComponent('Button') as typeof VideojsButton

class PopoutButton extends Button {
  declare private popoutButtonOptions: PopoutButtonOptions

  constructor (player: VideojsPlayer, options: PopoutButtonOptions & VideojsButtonOptions) {
    super(player, options)

    this.popoutButtonOptions = options

    this.controlText('Pop out player')

    this.updateShowing()
    this.player().on('video-change', () => this.updateShowing())
  }

  buildCSSClass () {
    return `vjs-popout-control ${super.buildCSSClass()}`
  }

  handleClick () {
    const embedUrl = this.popoutButtonOptions.embedUrl?.()
    if (!embedUrl) return

    const popupUrl = this.buildPopoutUrl(embedUrl)
    const placement = this.getPopupPlacement()
    const features = [
      'popup=yes',
      'toolbar=no',
      'location=no',
      'status=no',
      'menubar=no',
      'scrollbars=no',
      'resizable=yes',
      `width=${placement.width}`,
      `height=${placement.height}`,
      `left=${placement.left}`,
      `top=${placement.top}`
    ].join(',')

    const popup = window.open(popupUrl, '_blank', features)
    if (popup) {
      popup.focus()
      if (!this.player_.paused()) this.player_.pause()
    }
  }

  private buildPopoutUrl (embedUrl: string) {
    try {
      const url = new URL(embedUrl, window.location.href)
      const start = Math.floor(this.player_.currentTime?.() ?? 0)

      if (start > 0) url.searchParams.set('start', String(start))
      url.searchParams.set('autoplay', '1')

      return url.toString()
    } catch {
      return embedUrl
    }
  }

  private getPopupPlacement () {
    const videoWidth = this.player_.videoWidth?.() || 0
    const videoHeight = this.player_.videoHeight?.() || 0

    let width = videoWidth > 0 ? videoWidth : 640
    let height = videoHeight > 0 ? videoHeight : 360

    const availWidth = window.screen?.availWidth || width
    const availHeight = window.screen?.availHeight || height

    width = Math.min(width, availWidth)
    height = Math.min(height, availHeight)

    const left = Math.max(0, Math.floor((availWidth - width) / 2))
    const top = Math.max(0, Math.floor((availHeight - height) / 2))

    return { width, height, left, top }
  }

  private updateShowing () {
    if (this.popoutButtonOptions.isDisplayed()) this.show()
    else this.hide()
  }
}

videojs.registerComponent('PopoutButton', PopoutButton)
