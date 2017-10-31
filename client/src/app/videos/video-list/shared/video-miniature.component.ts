import { Component, Input } from '@angular/core'

import { SortField, Video } from '../../shared'
import { User } from '../../../shared'

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
