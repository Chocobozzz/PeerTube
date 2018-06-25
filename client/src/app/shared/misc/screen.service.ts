import { Injectable } from '@angular/core'

@Injectable()
export class ScreenService {
  private windowInnerWidth: number
  private lastFunctionCallTime: number
  private cacheForMs = 500

  constructor () {
    this.refreshWindowInnerWidth()
  }

  isInSmallView () {
    return this.getWindowInnerWidth() < 600
  }

  isInMobileView () {
    return this.getWindowInnerWidth() < 500
  }

  // Cache window inner width, because it's an expensive call
  private getWindowInnerWidth () {
    if (this.cacheWindowInnerWidthExpired()) this.refreshWindowInnerWidth()

    return this.windowInnerWidth
  }

  private refreshWindowInnerWidth () {
    this.lastFunctionCallTime = new Date().getTime()

    this.windowInnerWidth = window.innerWidth
  }

  private cacheWindowInnerWidthExpired () {
    return new Date().getTime() > (this.lastFunctionCallTime + this.cacheForMs)
  }
}
