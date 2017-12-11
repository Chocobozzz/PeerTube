import { Component, Input } from '@angular/core'
import { Video } from './video.model'

@Component({
  selector: 'my-video-thumbnail',
  styleUrls: [ './video-thumbnail.component.scss' ],
  templateUrl: './video-thumbnail.component.html'
})
export class VideoThumbnailComponent {
  @Input() video: Video
  @Input() nsfw = false
}
