import { Component, OnInit, input, numberAttribute } from '@angular/core'
import { ActorAvatarComponent, ActorAvatarInput } from '@app/shared/shared-actor-image/actor-avatar.component'

@Component({
  selector: 'my-account-on-channel-avatar',
  templateUrl: './account-on-channel-avatar.component.html',
  styleUrls: [ './account-on-channel-avatar.component.scss' ],
  imports: [ ActorAvatarComponent ]
})
export class AccountOnChannelAvatarComponent implements OnInit {
  readonly account = input.required<ActorAvatarInput>()
  readonly channel = input.required<ActorAvatarInput>()
  readonly internalHref = input<string | any[]>(undefined)

  readonly showAccount = input(true)
  readonly showChannel = input(true)

  readonly size = input(35, { transform: numberAttribute })

  linkTitle = ''

  ngOnInit () {
    if (this.internalHref()) {
      if (this.showChannel()) {
        this.linkTitle = $localize`Go to ${this.channel().name} channel page`
      } else if (this.showAccount()) {
        this.linkTitle = $localize`Go to ${this.account().name} account page`
      }
    }
  }

  getAccountSize () {
    return this.showChannel()
      ? Math.round(this.size() * 0.6)
      : this.size()
  }
}
