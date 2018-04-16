import { Component, Input, OnChanges, SimpleChanges } from '@angular/core'

@Component({
  selector: 'my-video-feed',
  styleUrls: [ './video-feed.component.scss' ],
  templateUrl: './video-feed.component.html'
})
export class VideoFeedComponent implements OnChanges {
  @Input() syndicationItems

  ngOnChanges (changes: SimpleChanges) {
    this.syndicationItems = changes.syndicationItems.currentValue
  }
}
