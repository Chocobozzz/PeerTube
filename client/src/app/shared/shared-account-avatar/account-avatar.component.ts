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

  defaultAvatarUrl = Account.GET_DEFAULT_AVATAR_URL()

  private _title: string

  get title () {
    return this._title || $localize`${this.account.name} (account page)`
  }

  get class () {
    return `avatar avatar-${this.size}` + (this.avatarUrl ? '' : ` initial ${this.getColorTheme()}`)
  }

  get avatarUrl () {
    return Account.GET_ACTOR_AVATAR_URL(this.account)
  }

  get initial () {
    return this.account?.name.slice(0, 1)
  }

  private getColorTheme () {
    const themes = {
      abc: 'blue',
      def: 'green',
      ghi: 'purple',
      jkl: 'gray',
      mno: 'yellow',
      pqr: 'orange',
      stv: 'red',
      wxyz: 'dark-blue'
    }

    const theme = Object.keys(themes).find(chars => chars.includes(this.initial))

    return themes[theme]
  }
}
