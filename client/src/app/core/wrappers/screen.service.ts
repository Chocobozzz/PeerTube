import { Injectable } from '@angular/core'

@Injectable()
export class ScreenService {
  isBroadcastMessageDisplayed = false

  private windowInnerWidth: number
  private lastFunctionCallTime: number
  private cacheForMs = 500

  constructor () {
    this.refreshWindowInnerWidth()
  }

  isInSmallView (marginLeft = 0) {
    if (marginLeft > 0) {
      const contentWidth = this.getWindowInnerWidth() - marginLeft
      return contentWidth < 800
    }

    return this.getWindowInnerWidth() < 800
  }

  isInMediumView () {
    return this.getWindowInnerWidth() < 1100
  }

  isInMobileView () {
    return this.getWindowInnerWidth() < 500
  }

  isInTouchScreen () {
    return !!('ontouchstart' in window || navigator.msMaxTouchPoints)
  }

  getNumberOfAvailableMiniatures () {
    const screenWidth = this.getWindowInnerWidth()

    let numberOfVideos = 1

    if (screenWidth > 1850) numberOfVideos = 5
    else if (screenWidth > 1410) numberOfVideos = 4
    else if (screenWidth > 1120) numberOfVideos = 3
    else if (screenWidth > 890) numberOfVideos = 2

    return numberOfVideos
  }

  // Cache window inner width, because it's an expensive call
  getWindowInnerWidth () {
    if (this.cacheWindowInnerWidthExpired()) this.refreshWindowInnerWidth()

    return this.windowInnerWidth
  }

  // https://stackoverflow.com/questions/2264072/detect-a-finger-swipe-through-javascript-on-the-iphone-and-android
  onFingerSwipe (direction: 'left' | 'right' | 'up' | 'down', action: () => void, removeEventOnEnd = true) {
    let touchDownClientX: number
    let touchDownClientY: number

    const onTouchStart = (event: TouchEvent) => {
      const firstTouch = event.touches[0]
      touchDownClientX = firstTouch.clientX
      touchDownClientY = firstTouch.clientY
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!touchDownClientX || !touchDownClientY) {
        return
      }

      const touchUpClientX = event.touches[0].clientX
      const touchUpClientY = event.touches[0].clientY

      const touchClientX = Math.abs(touchDownClientX - touchUpClientX)
      const touchClientY = Math.abs(touchDownClientY - touchUpClientY)

      if (touchClientX > touchClientY) {
        if (touchClientX > 0) {
          if (direction === 'left') {
            if (removeEventOnEnd) this.removeFingerSwipeEventListener(onTouchStart, onTouchMove)
            action()
          }
        } else {
          if (direction === 'right') {
            if (removeEventOnEnd) this.removeFingerSwipeEventListener(onTouchStart, onTouchMove)
            action()
          }
        }
      } else {
        if (touchClientY > 0) {
          if (direction === 'up') {
            if (removeEventOnEnd) this.removeFingerSwipeEventListener(onTouchStart, onTouchMove)
            action()
          }
        } else {
          if (direction === 'down') {
            if (removeEventOnEnd) this.removeFingerSwipeEventListener(onTouchStart, onTouchMove)
            action()
          }
        }
      }
    }

    document.addEventListener('touchstart', onTouchStart, false)
    document.addEventListener('touchmove', onTouchMove, false)
  }

  private removeFingerSwipeEventListener (onTouchStart: (event: TouchEvent) => void, onTouchMove: (event: TouchEvent) => void) {
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchmove', onTouchMove)
  }

  private refreshWindowInnerWidth () {
    this.lastFunctionCallTime = new Date().getTime()

    this.windowInnerWidth = window.innerWidth
  }

  private cacheWindowInnerWidthExpired () {
    if (!this.lastFunctionCallTime) return true

    return new Date().getTime() > (this.lastFunctionCallTime + this.cacheForMs)
  }
}
