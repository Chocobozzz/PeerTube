import { Component, Input } from '@angular/core'
import { Video } from '../shared-main'

@Component({
  selector: 'my-video-views-counter',
  styleUrls: [ './video-views-counter.component.scss' ],
  templateUrl: './video-views-counter.component.html'
})
export class VideoViewsCounterComponent {
  @Input() video: Video
}
