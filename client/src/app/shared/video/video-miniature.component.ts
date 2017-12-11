import { Component, Input } from '@angular/core'
import { User } from '../users'
import { Video } from './video.model'

@Component({
  selector: 'my-video-miniature',
  styleUrls: [ './video-miniature.component.scss' ],
  templateUrl: './video-miniature.component.html'
})
export class VideoMiniatureComponent {
  @Input() user: User
  @Input() video: Video

  isVideoNSFWForThisUser () {
    return this.video.isVideoNSFWForUser(this.user)
  }
}
