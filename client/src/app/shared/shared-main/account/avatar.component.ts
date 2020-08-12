import { Component, Input, OnInit } from '@angular/core'
import { Video } from '../video/video.model'

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

  ngOnInit () {
    this.channelLinkTitle = $localize`${this.video.account.name} (channel page)`
    this.accountLinkTitle = $localize`${this.video.byAccount} (account page)`
  }

  isChannelAvatarNull () {
    return this.video.channel.avatar === null
  }
}
