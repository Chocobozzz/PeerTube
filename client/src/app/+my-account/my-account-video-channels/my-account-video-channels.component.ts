import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { User } from '@app/shared'
import { flatMap } from 'rxjs/operators'
import { I18n } from '@ngx-translate/i18n-polyfill'

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
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private videoChannelService: VideoChannelService,
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.user = this.authService.getUser()

    this.loadVideoChannels()
  }

  async deleteVideoChannel (videoChannel: VideoChannel) {
    const res = await this.confirmService.confirmWithInput(
      this.i18n(
        'Do you really want to delete {{videoChannelName}}? It will delete all videos uploaded in this channel too.',
        { videoChannelName: videoChannel.displayName }
      ),
      this.i18n('Please type the name of the video channel to confirm'),
      videoChannel.displayName,
      this.i18n('Delete')
    )
    if (res === false) return

    this.videoChannelService.removeVideoChannel(videoChannel)
      .subscribe(
        () => {
          this.loadVideoChannels()
          this.notifier.success(
            this.i18n('Video channel {{videoChannelName}} deleted.', { videoChannelName: videoChannel.displayName })
          )
        },

        error => this.notifier.error(error.message)
      )
  }

  private loadVideoChannels () {
    this.authService.userInformationLoaded
        .pipe(flatMap(() => this.videoChannelService.listAccountVideoChannels(this.user.account)))
        .subscribe(res => this.videoChannels = res.data)
  }
}
