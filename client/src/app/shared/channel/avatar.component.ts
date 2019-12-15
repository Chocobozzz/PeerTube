import { Component, Input } from '@angular/core'
import { VideoDetails } from '../video/video-details.model'

@Component({
  selector: 'avatar-channel',
  templateUrl: './avatar.component.html',
  styleUrls: [ './avatar.component.scss' ]
})
export class AvatarComponent {
  @Input() video: VideoDetails
}
