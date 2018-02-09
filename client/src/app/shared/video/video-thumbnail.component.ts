import { Component, Input } from '@angular/core'
import { isInMobileView } from '@app/shared/misc/utils'
import { Video } from './video.model'

@Component({
  selector: 'my-video-thumbnail',
  styleUrls: [ './video-thumbnail.component.scss' ],
  templateUrl: './video-thumbnail.component.html'
})
export class VideoThumbnailComponent {
  @Input() video: Video
  @Input() nsfw = false

  getImageUrl () {
    if (!this.video) return ''

    if (isInMobileView()) {
      return this.video.previewUrl
    }

    return this.video.thumbnailUrl
  }
}
