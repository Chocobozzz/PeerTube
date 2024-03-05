import { Component, Input } from '@angular/core'
import { Video } from '../shared-main/video/video.model'

@Component({
  selector: 'my-video-cell',
  styleUrls: [ 'video-cell.component.scss' ],
  templateUrl: 'video-cell.component.html',
  standalone: true
})
export class VideoCellComponent {
  @Input() video: Video

  getVideoUrl () {
    return Video.buildWatchUrl(this.video)
  }
}
