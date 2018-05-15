import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { User } from '@app/shared'
import { flatMap } from 'rxjs/operators'

@Component({
  selector: 'my-account-video-channels',
  templateUrl: './my-account-video-channels.component.html',
  styleUrls: [ './my-account-video-channels.component.scss' ]
})
export class MyAccountVideoChannelsComponent implements OnInit {
  videoChannels: VideoChannel[] = []

  private user: User

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private videoChannelService: VideoChannelService
  ) {}

  ngOnInit () {
    this.user = this.authService.getUser()

    this.loadVideoChannels()
  }

  async deleteVideoChannel (videoChannel: VideoChannel) {
    const res = await this.confirmService.confirmWithInput(
      `Do you really want to delete ${videoChannel.displayName}? It will delete all videos uploaded in this channel too.`,
      'Please type the name of the video channel to confirm',
      videoChannel.displayName,
      'Delete'
    )
    if (res === false) return

    this.videoChannelService.removeVideoChannel(videoChannel)
      .subscribe(
        status => {
          this.loadVideoChannels()
          this.notificationsService.success('Success', `Video channel ${videoChannel.name} deleted.`)
        },

        error => this.notificationsService.error('Error', error.message)
      )
  }

  private loadVideoChannels () {
    this.authService.userInformationLoaded
        .pipe(flatMap(() => this.videoChannelService.listAccountVideoChannels(this.user.account.id)))
        .subscribe(res => this.videoChannels = res.data)
  }
}
