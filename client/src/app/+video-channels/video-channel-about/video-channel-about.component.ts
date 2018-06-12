import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'

@Component({
  selector: 'my-video-channel-about',
  templateUrl: './video-channel-about.component.html',
  styleUrls: [ './video-channel-about.component.scss' ]
})
export class VideoChannelAboutComponent implements OnInit, OnDestroy {
  videoChannel: VideoChannel

  private videoChannelSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private i18n: I18n,
    private videoChannelService: VideoChannelService
  ) { }

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
      .subscribe(videoChannel => this.videoChannel = videoChannel)
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()
  }

  getVideoChannelDescription () {
    if (this.videoChannel.description) return this.videoChannel.description

    return this.i18n('No description')
  }
}
