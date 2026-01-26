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

  isInSmallView () {
    // Keep it sync with SASS variable
    return this.getWindowInnerWidth() < 800
  }

  isInMobileView () {
    // Keep it sync with SASS variable
    return this.getWindowInnerWidth() < 500
  }

  isInMenuOverlayView () {
    // Keep it sync with $menu-overlay-view SASS variable
    return this.getWindowInnerWidth() < 1200
  }

  isInTouchScreen () {
    return !!('ontouchstart' in window || (navigator as any).msMaxTouchPoints)
  }

  // Cache window inner width, because it's an expensive call
  getWindowInnerWidth () {
    if (this.cacheWindowInnerWidthExpired()) this.refreshWindowInnerWidth()

    return this.windowInnerWidth
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
