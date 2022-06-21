import { Component, Input, OnChanges } from '@angular/core'
import { VideoChannel } from '../shared-main'
import { Account } from '../shared-main/account/account.model'

type ActorInput = {
  name: string
  avatars: { width: number, url?: string, path: string }[]
  url: string
}

export type ActorAvatarSize = '18' | '25' | '28' | '32' | '34' | '35' | '36' | '40' | '48' | '75' | '80' | '100' | '120'

@Component({
  selector: 'my-actor-avatar',
  styleUrls: [ './actor-avatar.component.scss' ],
  templateUrl: './actor-avatar.component.html'
})
export class ActorAvatarComponent implements OnChanges {
  private _title: string

  @Input() account: ActorInput
  @Input() channel: ActorInput

  @Input() previewImage: string

  @Input() size: ActorAvatarSize

  // Use an external link
  @Input() href: string
  // Use routerLink
  @Input() internalHref: string | any[]

  @Input() set title (value) {
    this._title = value
  }

  get title () {
    if (this._title) return this._title
    if (this.account) return $localize`${this.account.name} (account page)`
    if (this.channel) return $localize`${this.channel.name} (channel page)`

    return ''
  }

  classes: string[] = []

  get alt () {
    if (this.account) return $localize`Account avatar`
    if (this.channel) return $localize`Channel avatar`

    return ''
  }

  get defaultAvatarUrl () {
    if (this.account) return Account.GET_DEFAULT_AVATAR_URL(this.getSizeNumber())
    if (this.channel) return VideoChannel.GET_DEFAULT_AVATAR_URL(this.getSizeNumber())
  }

  get avatarUrl () {
    if (this.account) return Account.GET_ACTOR_AVATAR_URL(this.account, this.getSizeNumber())
    if (this.channel) return VideoChannel.GET_ACTOR_AVATAR_URL(this.channel, this.getSizeNumber())

    return ''
  }

  get initial () {
    const name = this.account?.name
    if (!name) return ''

    return name.slice(0, 1)
  }

  ngOnChanges () {
    this.classes = [ 'avatar' ]

    if (this.size) this.classes.push(`avatar-${this.size}`)

    if (this.channel) this.classes.push('channel')
    else this.classes.push('account')

    if (!this.avatarUrl && this.initial) {
      this.classes.push('initial')
      this.classes.push(this.getColorTheme())
    }
  }

  hasActor () {
    return !!this.account || !!this.channel
  }

  private getSizeNumber () {
    if (this.size) return +this.size

    return undefined
  }

  private getColorTheme () {
    const initialLowercase = this.initial.toLowerCase()

    // Keep consistency with CSS
    const themes = {
      '0123456789abc': 'blue',
      def: 'green',
      ghi: 'purple',
      jkl: 'gray',
      mno: 'yellow',
      pqr: 'orange',
      stvu: 'red',
      wxyz: 'dark-blue'
    }

    const theme = Object.keys(themes)
                        .find(chars => chars.includes(initialLowercase))

    return themes[theme]
  }
}
