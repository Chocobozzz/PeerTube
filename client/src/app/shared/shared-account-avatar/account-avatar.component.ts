import { Component, Input } from '@angular/core'
import { Account as AccountInterface } from '@shared/models'
import { Account } from '../shared-main/account/account.model'

@Component({
  selector: 'my-account-avatar',
  styleUrls: [ './account-avatar.component.scss' ],
  templateUrl: './account-avatar.component.html'
})
export class AccountAvatarComponent {
  @Input() account: { name: string, avatar?: { url?: string }, url: string }
  @Input() size = '36'

  get class () {
    return `avatar avatar-${this.size}`
  }

  get linkTitle () {
    return $localize`${this.account.name} (account page)`
  }

  get avatarUrl () {
    return this.account?.avatar ? this.account.avatar.url : Account.GET_DEFAULT_AVATAR_URL()
  }
}
