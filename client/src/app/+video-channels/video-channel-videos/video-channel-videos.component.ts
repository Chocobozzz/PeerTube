import { Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core'
import { ComponentPaginationLight, DisableForReuseHook, HooksService, ScreenService } from '@app/core'
import { Video, VideoSortField } from '@peertube/peertube-models'
import { VideosListComponent } from '../../shared/shared-video-miniature/videos-list.component'
import { NgIf } from '@angular/common'
import { VideoChannel } from '@app/shared/shared-main/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/video-channel/video-channel.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature/video-miniature.component'
import { VideoFilters } from '@app/shared/shared-video-miniature/video-filters.model'

@Component({
  selector: 'my-video-channel-videos',
  templateUrl: './video-channel-videos.component.html',
  standalone: true,
  imports: [ NgIf, VideosListComponent ]
})
export class VideoChannelVideosComponent implements OnInit, AfterViewInit, OnDestroy, DisableForReuseHook {
  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)

  title = $localize`Videos`
  defaultSort = '-publishedAt' as VideoSortField

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: false,
    avatar: false,
    privacyLabel: true,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  videoChannel: VideoChannel
  disabled = false

  private videoChannelSub: Subscription

  constructor (
    private screenService: ScreenService,
    private videoChannelService: VideoChannelService,
    private videoService: VideoService,
    private hooks: HooksService
  ) {
  }

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelService.videoChannelLoaded.pipe(first())
      .subscribe(videoChannel => {
        this.videoChannel = videoChannel

        this.hooks.runAction('action:video-channel-videos.video-channel.loaded', 'video-channel', { videoChannel })
      })
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-videos.init', 'video-channel')
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()
  }

  getVideosObservable (pagination: ComponentPaginationLight, filters: VideoFilters) {
    const params = {
      ...filters.toVideosAPIObject(),

      videoPagination: pagination,
      videoChannel: this.videoChannel,
      skipCount: true
    }

    return this.videoService.getVideoChannelVideos(params)
  }

  getSyndicationItems () {
    return this.videoService.getVideoChannelFeedUrls(this.videoChannel.id)
  }

  displayAsRow () {
    return this.screenService.isInMobileView()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  onVideosLoaded (videos: Video[]) {
    this.hooks.runAction('action:video-channel-videos.videos.loaded', 'video-channel', { videos })
  }
}
