import { Component, Input } from '@angular/core'
import { Account } from '../shared-main/account/account.model'

@Component({
  selector: 'my-account-avatar',
  styleUrls: [ './account-avatar.component.scss' ],
  templateUrl: './account-avatar.component.html'
})
export class AccountAvatarComponent {
  @Input() account: {
    name: string
    avatar?: { url?: string, path: string }
    url: string
  }
  @Input() size: '25' | '34' | '36' | '40' | '120' = '36'

  // Use an external link
  @Input() href: string
  // Use routerLink
  @Input() internalHref: string | string[]

  @Input() set title (value) {
    this._title = value
  }

  private _title: string

  get title () {
    return this._title || $localize`${this.account.name} (account page)`
  }

  get class () {
    return `avatar avatar-${this.size}`
  }

  get avatarUrl () {
    return Account.GET_ACTOR_AVATAR_URL(this.account)
  }
}
