import { Component, Input, OnInit } from '@angular/core'
import { Video } from '../video/video.model'

@Component({
  selector: 'my-video-avatar-channel',
  templateUrl: './video-avatar-channel.component.html',
  styleUrls: [ './video-avatar-channel.component.scss' ]
})
export class VideoAvatarChannelComponent implements OnInit {
  @Input() video: Video
  @Input() byAccount: string

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
