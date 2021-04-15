import { Component, Input } from '@angular/core'
import { Account as AccountInterface } from '@shared/models'
import { Account } from '../shared-main/account/account.model'

@Component({
  selector: 'my-account-avatar',
  styleUrls: [ './account-avatar.component.scss' ],
  templateUrl: './account-avatar.component.html'
})
export class AccountAvatarComponent {
  _href: string
  _title: string

  @Input() account: { name: string, avatar?: { url?: string }, url: string }
  @Input() size = '36'
  @Input() set href (value) {
    this._href = value
  }
  @Input() set title (value) {
    this._title = value
  }

  get href () {
    return this._href || this.account?.url
  }

  get title () {
    return this._title || $localize`${this.account.name} (account page)`
  }

  get class () {
    return `avatar avatar-${this.size}`
  }

  get avatarUrl () {
    return this.account?.avatar ? this.account.avatar.url : Account.GET_DEFAULT_AVATAR_URL()
  }
}
