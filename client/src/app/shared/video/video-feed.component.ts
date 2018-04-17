import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-video-feed',
  styleUrls: [ './video-feed.component.scss' ],
  templateUrl: './video-feed.component.html'
})
export class VideoFeedComponent {
  @Input() syndicationItems
}
