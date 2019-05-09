import { Component, OnDestroy, OnInit } from '@angular/core'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Subscription } from 'rxjs'
import { MarkdownService } from '@app/shared/renderer'

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
    private i18n: I18n,
    private videoChannelService: VideoChannelService,
    private markdownService: MarkdownService
  ) { }

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
      .subscribe(async videoChannel => {
        this.videoChannel = videoChannel

        this.descriptionHTML = await this.markdownService.textMarkdownToHTML(this.videoChannel.description)
        this.supportHTML = await this.markdownService.enhancedMarkdownToHTML(this.videoChannel.support)
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
