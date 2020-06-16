import { Component, AfterViewChecked } from '@angular/core'
import { ViewportScroller } from '@angular/common'

@Component({
  selector: 'my-about-peertube',
  templateUrl: './about-peertube.component.html',
  styleUrls: [ './about-peertube.component.scss' ]
})

export class AboutPeertubeComponent implements AfterViewChecked {
  private lastScrollHash: string

  constructor (
    private viewportScroller: ViewportScroller
  ) {}

  ngAfterViewChecked () {
    if (window.location.hash && window.location.hash !== this.lastScrollHash) {
      this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))

      this.lastScrollHash = window.location.hash
    }
  }
}
