import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'
import { MarkdownService } from '@app/videos/shared'

@Component({
  selector: 'my-video-channel-about',
  templateUrl: './video-channel-about.component.html',
  styleUrls: [ './video-channel-about.component.scss' ]
})
export class VideoChannelAboutComponent implements OnInit, OnDestroy {
  videoChannel: VideoChannel
  descriptionHTML = ''
  supportHTML = ''

  private videoChannelSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private i18n: I18n,
    private videoChannelService: VideoChannelService,
    private markdownService: MarkdownService
  ) { }

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
      .subscribe(videoChannel => {
        this.videoChannel = videoChannel

        this.descriptionHTML = this.markdownService.textMarkdownToHTML(this.videoChannel.description)
        this.supportHTML = this.markdownService.enhancedMarkdownToHTML(this.videoChannel.support)
      })
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()
  }

  getVideoChannelDescription () {
    if (this.descriptionHTML) return this.descriptionHTML

    return this.i18n('No description')
  }
}
