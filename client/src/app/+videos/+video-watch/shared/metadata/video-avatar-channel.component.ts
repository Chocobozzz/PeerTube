import { Component, Input, OnInit } from '@angular/core'
import { ActorAvatarComponent } from '../../../../shared/shared-actor-image/actor-avatar.component'
import { NgIf } from '@angular/common'
import { Video } from '@app/shared/shared-main/video/video.model'

@Component({
  selector: 'my-video-avatar-channel',
  templateUrl: './video-avatar-channel.component.html',
  styleUrls: [ './video-avatar-channel.component.scss' ],
  imports: [ NgIf, ActorAvatarComponent ]
})
export class VideoAvatarChannelComponent implements OnInit {
  @Input() video: Video
  @Input() byAccount: string

  @Input() showAccount: boolean
  @Input() showChannel: boolean

  channelLinkTitle = ''
  accountLinkTitle = ''

  ngOnInit () {
    this.channelLinkTitle = $localize`${this.video.account.name} (channel page)`
    this.accountLinkTitle = $localize`${this.video.byAccount} (account page)`
  }
}
