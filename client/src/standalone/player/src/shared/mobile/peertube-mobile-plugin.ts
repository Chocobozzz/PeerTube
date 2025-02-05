import debug from 'debug'
import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { PeerTubeMobileButtons } from './peertube-mobile-buttons'

const debugLogger = debug('peertube:player:mobile')

const Plugin = videojs.getPlugin('plugin')

class PeerTubeMobilePlugin extends Plugin {
  private static readonly DOUBLE_TAP_DELAY_MS = 250
  private static readonly SET_CURRENT_TIME_DELAY = 750

  declare private peerTubeMobileButtons: PeerTubeMobileButtons

  declare private seekAmount: number
  declare private doubleTapping: boolean

  declare private lastTapEvent: TouchEvent
  declare private tapTimeout: ReturnType<typeof setTimeout>
  declare private newActiveState: boolean

  declare private setCurrentTimeTimeout: ReturnType<typeof setTimeout>

  declare private onPlayHandler: () => void
  declare private onFullScreenChangeHandler: () => void
  declare private onTouchStartHandler: (event: TouchEvent) => void
  declare private onMobileButtonTouchStartHandler: (event: TouchEvent) => void
  declare private sliderActiveHandler: () => void
  declare private sliderInactiveHandler: () => void

  declare private seekBar: videojs.Component

  constructor (player: videojs.Player, options: videojs.PlayerOptions) {
    super(player, options)

    this.seekAmount = 0

    if (videojs.browser.IS_ANDROID && screen.orientation) {
      this.handleFullscreenRotation()
    }

    // Don't add buttons if the player doesn't have controls
    if (!player.controls()) return

    this.peerTubeMobileButtons = player.addChild('PeerTubeMobileButtons', { reportTouchActivity: false }) as PeerTubeMobileButtons

    if (!this.player.options_.userActions) this.player.options_.userActions = {};

    // FIXME: typings
    (this.player.options_.userActions as any).click = false
    this.player.options_.userActions.doubleClick = false

    this.onPlayHandler = () => this.initTouchStartEvents()
    this.player.one('play', this.onPlayHandler)

    this.seekBar = this.player.getDescendant([ 'controlBar', 'progressControl', 'seekBar' ])

    this.sliderActiveHandler = () => this.player.addClass('vjs-mobile-sliding')
    this.sliderInactiveHandler = () => this.player.removeClass('vjs-mobile-sliding')

    this.seekBar.on('slideractive', this.sliderActiveHandler)
    this.seekBar.on('sliderinactive', this.sliderInactiveHandler)
  }

  dispose () {
    if (this.onPlayHandler) this.player.off('play', this.onPlayHandler)
    if (this.onFullScreenChangeHandler) this.player.off('fullscreenchange', this.onFullScreenChangeHandler)
    if (this.onTouchStartHandler) this.player.off('touchstart', this.onFullScreenChangeHandler)
    if (this.onMobileButtonTouchStartHandler) {
      this.peerTubeMobileButtons?.el().removeEventListener('touchstart', this.onMobileButtonTouchStartHandler)
    }

    super.dispose()
  }

  private handleFullscreenRotation () {
    this.onFullScreenChangeHandler = () => {
      if (!this.player.isFullscreen() || this.isPortraitVideo()) return;

      // https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1615
      (screen.orientation as any).lock('landscape')
        .catch((err: Error) => logger.error('Cannot lock screen to landscape.', err))
    }

    this.player.on('fullscreenchange', this.onFullScreenChangeHandler)
  }

  private isPortraitVideo () {
    return this.player.videoWidth() < this.player.videoHeight()
  }

  private initTouchStartEvents () {
    const handleTouchStart = (event: TouchEvent, onlyDetectDoubleTap = false) => {
      debugLogger('Handle touch start')

      if (this.tapTimeout) {
        clearTimeout(this.tapTimeout)
        this.tapTimeout = undefined
      }

      if (
        this.doubleTapping ||
        (this.lastTapEvent && event.timeStamp - this.lastTapEvent.timeStamp < PeerTubeMobilePlugin.DOUBLE_TAP_DELAY_MS)
      ) {
        debugLogger('Detected double tap')

        this.lastTapEvent = event
        this.onDoubleTap(event)
        return
      }

      if (onlyDetectDoubleTap) return

      this.newActiveState = !this.player.userActive()

      // video.js forces userActive on tap so we prevent this behaviour with a custom class
      if (!this.player.paused() && this.newActiveState === true) {
        this.player.addClass('vjs-force-inactive')
      }

      this.tapTimeout = setTimeout(() => {
        debugLogger('No double tap detected, set user active state to ' + this.newActiveState)

        this.player.removeClass('vjs-force-inactive')
        this.player.userActive(this.newActiveState)
      }, PeerTubeMobilePlugin.DOUBLE_TAP_DELAY_MS)

      this.lastTapEvent = event
    }

    this.onTouchStartHandler = event => {
      // If user is active, only listen to mobile button overlay events to know if we need to hide them
      const onlyDetectDoubleTap = this.player.userActive()

      handleTouchStart(event, onlyDetectDoubleTap)
    }
    this.player.on('touchstart', this.onTouchStartHandler)

    this.onMobileButtonTouchStartHandler = event => {
      // Prevent mousemove/click/tap events firing on the player, that conflict with our user active logic
      event.preventDefault()
      event.stopPropagation()

      handleTouchStart(event)
    }

    this.peerTubeMobileButtons.el().addEventListener('touchstart', this.onMobileButtonTouchStartHandler, { passive: false })
  }

  private onDoubleTap (event: TouchEvent) {
    const playerWidth = this.player.currentWidth()

    const rect = this.findPlayerTarget((event.target as HTMLElement)).getBoundingClientRect()
    const offsetX = event.targetTouches[0].pageX - rect.left

    debugLogger('Calculating double tap zone (player width: %d, offset X: %d)', playerWidth, offsetX)

    if (offsetX > 0.66 * playerWidth) {
      if (this.seekAmount < 0) this.seekAmount = 0

      this.seekAmount += 10

      debugLogger('Will forward %d seconds', this.seekAmount)
    } else if (offsetX < 0.33 * playerWidth) {
      if (this.seekAmount > 0) this.seekAmount = 0

      this.seekAmount -= 10
      debugLogger('Will rewind %d seconds', this.seekAmount)
    }

    this.peerTubeMobileButtons.displayFastSeek(this.seekAmount)

    this.scheduleSetCurrentTime()
  }

  private findPlayerTarget (target: HTMLElement): HTMLElement {
    if (target.classList.contains('video-js')) return target

    return this.findPlayerTarget(target.parentElement)
  }

  private scheduleSetCurrentTime () {
    this.player.pause()
    this.player.addClass('vjs-fast-seeking')
    this.doubleTapping = true

    if (this.setCurrentTimeTimeout) clearTimeout(this.setCurrentTimeTimeout)

    this.setCurrentTimeTimeout = setTimeout(() => {
      let newTime = this.player.currentTime() + this.seekAmount
      this.seekAmount = 0

      newTime = Math.max(0, newTime)
      newTime = Math.min(this.player.duration(), newTime)

      this.player.currentTime(newTime)
      this.seekAmount = 0
      this.peerTubeMobileButtons.displayFastSeek(0)

      this.player.userActive(false)
      this.doubleTapping = false

      this.player.play()

      setTimeout(() => {
        this.player.removeClass('vjs-fast-seeking')
        this.player.removeClass('vjs-force-inactive')
      }, 100)
    }, PeerTubeMobilePlugin.SET_CURRENT_TIME_DELAY)
  }
}

videojs.registerPlugin('peertubeMobile', PeerTubeMobilePlugin)
export { PeerTubeMobilePlugin }
