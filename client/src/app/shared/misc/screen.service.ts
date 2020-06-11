import { Injectable } from '@angular/core'

@Injectable()
export class ScreenService {
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
    return 'ontouchstart' in window || navigator.msMaxTouchPoints
  }

  getNumberOfAvailableMiniatures () {
    const screenWidth = this.getWindowInnerWidth()

    let numberOfVideos = 1

    if (screenWidth > 1850) numberOfVideos = 7
    else if (screenWidth > 1600) numberOfVideos = 6
    else if (screenWidth > 1370) numberOfVideos = 5
    else if (screenWidth > 1100) numberOfVideos = 4
    else if (screenWidth > 850) numberOfVideos = 3

    return numberOfVideos
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
