import { Component, Input, OnInit } from '@angular/core'
import { Video } from '../video/video.model'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'avatar-channel',
  templateUrl: './avatar.component.html',
  styleUrls: [ './avatar.component.scss' ]
})
export class AvatarComponent implements OnInit {
  @Input() video: Video
  @Input() size: 'md' | 'sm' = 'md'
  @Input() genericChannel: boolean

  channelLinkTitle = ''
  accountLinkTitle = ''

  constructor (
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.channelLinkTitle = this.i18n(
      '{{name}} (channel page)',
      { name: this.video.channel.name, handle: this.video.byVideoChannel }
    )
    this.accountLinkTitle = this.i18n(
      '{{name}} (account page)',
      { name: this.video.account.name, handle: this.video.byAccount }
    )
  }

  isChannelAvatarNull () {
    return this.video.channel.avatar === null
  }
}
