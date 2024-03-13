import debug from 'debug'
import videojs from 'video.js'
import { logger } from '@root-helpers/logger'
import { PeerTubeMobileButtons } from './peertube-mobile-buttons'

const debugLogger = debug('peertube:player:mobile')

const Plugin = videojs.getPlugin('plugin')

class PeerTubeMobilePlugin extends Plugin {
  private static readonly DOUBLE_TAP_DELAY_MS = 250
  private static readonly SET_CURRENT_TIME_DELAY = 1000

  private peerTubeMobileButtons: PeerTubeMobileButtons

  private seekAmount = 0

  private lastTapEvent: TouchEvent
  private tapTimeout: ReturnType<typeof setTimeout>
  private newActiveState: boolean

  private setCurrentTimeTimeout: ReturnType<typeof setTimeout>

  private onPlayHandler: () => void
  private onFullScreenChangeHandler: () => void
  private onTouchStartHandler: (event: TouchEvent) => void
  private onMobileButtonTouchStartHandler: (event: TouchEvent) => void
  private sliderActiveHandler: () => void
  private sliderInactiveHandler: () => void

  private seekBar: videojs.Component

  constructor (player: videojs.Player, options: videojs.PlayerOptions) {
    super(player, options)

    this.peerTubeMobileButtons = player.addChild('PeerTubeMobileButtons', { reportTouchActivity: false }) as PeerTubeMobileButtons

    if (videojs.browser.IS_ANDROID && screen.orientation) {
      this.handleFullscreenRotation()
    }

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
    const handleTouchStart = (event: TouchEvent) => {
      if (this.tapTimeout) {
        clearTimeout(this.tapTimeout)
        this.tapTimeout = undefined
      }

      if (this.lastTapEvent && event.timeStamp - this.lastTapEvent.timeStamp < PeerTubeMobilePlugin.DOUBLE_TAP_DELAY_MS) {
        debugLogger('Detected double tap')

        this.lastTapEvent = undefined
        this.onDoubleTap(event)
        return
      }

      this.newActiveState = !this.player.userActive()

      this.tapTimeout = setTimeout(() => {
        debugLogger('No double tap detected, set user active state to %s.', this.newActiveState)

        this.player.userActive(this.newActiveState)
      }, PeerTubeMobilePlugin.DOUBLE_TAP_DELAY_MS)

      this.lastTapEvent = event
    }

    this.onTouchStartHandler = event => {
      // Only enable user active on player touch, we listen event on peertube mobile buttons to disable it
      if (this.player.userActive()) return

      handleTouchStart(event)
    }
    this.player.on('touchstart', this.onTouchStartHandler)

    this.onMobileButtonTouchStartHandler = event => {
      // Prevent mousemove/click events firing on the player, that conflict with our user active logic
      event.preventDefault()

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

    if (this.setCurrentTimeTimeout) clearTimeout(this.setCurrentTimeTimeout)

    this.setCurrentTimeTimeout = setTimeout(() => {
      let newTime = this.player.currentTime() + this.seekAmount
      this.seekAmount = 0

      newTime = Math.max(0, newTime)
      newTime = Math.min(this.player.duration(), newTime)

      this.player.currentTime(newTime)
      this.seekAmount = 0
      this.peerTubeMobileButtons.displayFastSeek(0)

      this.player.removeClass('vjs-fast-seeking')
      this.player.userActive(false)

      this.player.play()
    }, PeerTubeMobilePlugin.SET_CURRENT_TIME_DELAY)
  }
}

videojs.registerPlugin('peertubeMobile', PeerTubeMobilePlugin)
export { PeerTubeMobilePlugin }
