import videojs from 'video.js'
import { PopoutButtonOptions, VideojsButton, VideojsButtonOptions, VideojsPlayer } from '../../types'

const Button = videojs.getComponent('Button') as typeof VideojsButton

class PopoutButton extends Button {
  declare private popoutButtonOptions: PopoutButtonOptions
  private currentVideoElement: HTMLVideoElement | null = null
  private onEnterPiP = () => this.updateControlText()
  private onLeavePiP = () => this.updateControlText()

  constructor (player: VideojsPlayer, options: PopoutButtonOptions & VideojsButtonOptions) {
    super(player, options)

    this.popoutButtonOptions = options

    this.updateControlText()

    this.updateShowing()
    this.player().on('video-change', () => this.updateShowing())
    this.player().on('loadedmetadata', () => this.updateShowing())
  }

  buildCSSClass () {
    return `vjs-popout-control ${super.buildCSSClass()}`
  }

  async handleClick () {
    const video = this.getVideoElement()
    if (!video) return

    if (this.isInPictureInPicture(video)) {
      await this.exitPictureInPicture(video)
      return
    }

    if (this.isPictureInPictureSupported(video)) {
      await this.enterPictureInPicture(video)
    }
  }

  private updateControlText () {
    const video = this.getVideoElement()
    const isActive = video ? this.isInPictureInPicture(video) : false
    this.controlText(isActive ? 'Exit picture-in-picture' : 'Picture-in-picture')
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

  private getVideoElement () {
    const video = this.player_.el()?.querySelector('video')
    return (video instanceof HTMLVideoElement) ? video : null
  }

  private isPictureInPictureSupported (video: HTMLVideoElement) {
    const doc = document as Document & { pictureInPictureEnabled?: boolean }
    const standardSupported = !!(doc.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function')
    const webkitSupported = typeof (video as HTMLVideoElement & { webkitSetPresentationMode?: (mode: string) => void }).webkitSetPresentationMode === 'function'
    return standardSupported || webkitSupported
  }

  private isInPictureInPicture (video: HTMLVideoElement) {
    const doc = document as Document & { pictureInPictureElement?: Element | null }
    if (doc.pictureInPictureElement === video) return true

    const webkitVideo = video as HTMLVideoElement & { webkitPresentationMode?: string }
    return webkitVideo.webkitPresentationMode === 'picture-in-picture'
  }

  private async enterPictureInPicture (video: HTMLVideoElement) {
    try {
      if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture()
        this.updateControlText()
        return
      }

      const webkitVideo = video as HTMLVideoElement & { webkitSetPresentationMode?: (mode: string) => void }
      webkitVideo.webkitSetPresentationMode?.('picture-in-picture')
      this.updateControlText()
    } catch {
      // Ignore errors from user gesture or unsupported browser.
    }
  }

  private async exitPictureInPicture (video: HTMLVideoElement) {
    try {
      const doc = document as Document & { exitPictureInPicture?: () => Promise<void> }
      if (doc.exitPictureInPicture) {
        await doc.exitPictureInPicture()
        this.updateControlText()
        return
      }

      const webkitVideo = video as HTMLVideoElement & { webkitSetPresentationMode?: (mode: string) => void }
      webkitVideo.webkitSetPresentationMode?.('inline')
      this.updateControlText()
    } catch {
      // Ignore errors from user gesture or unsupported browser.
    }
  }

  private updateShowing () {
    const video = this.getVideoElement()

    if (video !== this.currentVideoElement) {
      if (this.currentVideoElement) {
        this.currentVideoElement.removeEventListener('enterpictureinpicture', this.onEnterPiP)
        this.currentVideoElement.removeEventListener('leavepictureinpicture', this.onLeavePiP)
      }

      this.currentVideoElement = video

      if (this.currentVideoElement) {
        this.currentVideoElement.addEventListener('enterpictureinpicture', this.onEnterPiP)
        this.currentVideoElement.addEventListener('leavepictureinpicture', this.onLeavePiP)
      }
    }

    const canShow = this.popoutButtonOptions.isDisplayed()
      && !!video
      && this.isPictureInPictureSupported(video)

    if (canShow) this.show()
    else this.hide()

    this.updateControlText()
  }
}

videojs.registerComponent('PopoutButton', PopoutButton)
