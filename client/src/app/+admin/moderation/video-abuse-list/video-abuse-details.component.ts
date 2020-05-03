import { Component, ViewEncapsulation, Input } from '@angular/core'
import { VideoAbuse } from '../../../../../../shared'
import { Account } from '@app/shared/account/account.model'

@Component({
  selector: 'my-video-abuse-details',
  templateUrl: './video-abuse-details.component.html',
  styleUrls: [ '../moderation.component.scss' ]
})
export class VideoAbuseDetailsComponent {
  @Input() videoAbuse: VideoAbuse

  createByString (account: Account) {
    return Account.CREATE_BY_STRING(account.name, account.host)
  }
}
