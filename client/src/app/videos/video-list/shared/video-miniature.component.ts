import { Component, Input } from '@angular/core'
import { User } from '../../../shared'
import { SortField } from '../../../shared/video/sort-field.type'
import { Video } from '../../../shared/video/video.model'

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html'
})
export class VideoMiniatureComponent {
  @Input() currentSort: SortField
  @Input() user: User
  @Input() video: Video

  isVideoNSFWForThisUser () {
    return this.video.isVideoNSFWForUser(this.user)
  }
}
