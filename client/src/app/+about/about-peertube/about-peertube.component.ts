import { Component, AfterViewChecked } from '@angular/core'
import { ViewportScroller } from '@angular/common'

@Component({
  selector: 'my-about-peertube',
  templateUrl: './about-peertube.component.html',
  styleUrls: [ './about-peertube.component.scss' ]
})

export class AboutPeertubeComponent implements AfterViewChecked {
  constructor (
    private viewportScroller: ViewportScroller
  ) {}

  ngAfterViewChecked () {
    if (window.location.hash) this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))
  }
}
