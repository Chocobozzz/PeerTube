import { Component, AfterViewChecked, inject } from '@angular/core'
import { ViewportScroller } from '@angular/common'

@Component({
  selector: 'my-about-peertube',
  templateUrl: './about-peertube.component.html',
  styleUrls: [ './about-peertube.component.scss' ],
  standalone: true
})
export class AboutPeertubeComponent implements AfterViewChecked {
  private viewportScroller = inject(ViewportScroller)

  private lastScrollHash: string

  ngAfterViewChecked () {
    if (window.location.hash && window.location.hash !== this.lastScrollHash) {
      this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))

      this.lastScrollHash = window.location.hash
    }
  }
}
