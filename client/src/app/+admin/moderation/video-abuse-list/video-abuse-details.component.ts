import { Component, Input } from '@angular/core'
import { Account } from '@app/shared/account/account.model'
import { Actor } from '@app/shared/actor/actor.model'
import { ProcessedVideoAbuse } from './video-abuse-list.component'

@Component({
  selector: 'my-video-abuse-details',
  templateUrl: './video-abuse-details.component.html',
  styleUrls: [ '../moderation.component.scss' ]
})
export class VideoAbuseDetailsComponent {
  @Input() videoAbuse: ProcessedVideoAbuse

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
  }
}
