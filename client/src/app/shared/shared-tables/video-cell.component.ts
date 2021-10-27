import { Component, Input } from '@angular/core'
import { Video } from '@app/shared/shared-main'

@Component({
  selector: 'my-video-cell',
  styleUrls: [ 'video-cell.component.scss' ],
  templateUrl: 'video-cell.component.html'
})
export class VideoCellComponent {
  @Input() video: Video

  getVideoUrl () {
    return Video.buildWatchUrl(this.video)
  }
}
