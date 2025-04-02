import { NgIf } from '@angular/common'
import { Component, OnInit, input } from '@angular/core'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { Video } from '@app/shared/shared-main/video/video.model'

@Component({
  selector: 'my-video-avatar-channel',
  templateUrl: './video-avatar-channel.component.html',
  styleUrls: [ './video-avatar-channel.component.scss' ],
  imports: [ NgIf, ActorAvatarComponent ]
})
export class VideoAvatarChannelComponent implements OnInit {
  readonly video = input<Video>(undefined)
  readonly byAccount = input<string>(undefined)

  readonly showAccount = input<boolean>(undefined)
  readonly showChannel = input<boolean>(undefined)

  channelLinkTitle = ''
  accountLinkTitle = ''

  ngOnInit () {
    this.channelLinkTitle = $localize`${this.video().account.name} (channel page)`
    this.accountLinkTitle = $localize`${this.video().byAccount} (account page)`
  }
}
