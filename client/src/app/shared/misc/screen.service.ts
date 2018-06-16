import { Injectable, NgZone } from '@angular/core'

@Injectable()
export class ScreenService {
  private windowInnerWidth: number

  constructor (private zone: NgZone) {
    this.windowInnerWidth = window.innerWidth

    // Try to cache a little bit window.innerWidth
    this.zone.runOutsideAngular(() => {
      setInterval(() => this.windowInnerWidth = window.innerWidth, 500)
    })
  }

  isInSmallView () {
    return this.windowInnerWidth < 600
  }

  isInMobileView () {
    return this.windowInnerWidth < 500
  }
}
