import { AfterViewInit, Component, OnDestroy, OnInit, inject, viewChild } from '@angular/core'
import { ComponentPaginationLight, DisableForReuseHook, HooksService, ScreenService } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoFilters } from '@app/shared/shared-video-miniature/video-filters.model'
import { Video, VideoSortField } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { VideosListComponent } from '../../shared/shared-video-miniature/videos-list.component'

@Component({
  selector: 'my-video-channel-videos',
  templateUrl: './video-channel-videos.component.html',
  imports: [ VideosListComponent ]
})
export class VideoChannelVideosComponent implements OnInit, AfterViewInit, OnDestroy, DisableForReuseHook {
  private screenService = inject(ScreenService)
  private videoChannelService = inject(VideoChannelService)
  private videoService = inject(VideoService)
  private hooks = inject(HooksService)

  readonly videosList = viewChild<VideosListComponent>('videosList')

  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)

  defaultSort = '-publishedAt' as VideoSortField

  videoChannel: VideoChannel
  disabled = false

  private videoChannelSub: Subscription
  private alreadyLoaded = false

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
      .subscribe(videoChannel => {
        if (this.videoChannel?.id === videoChannel.id) return

        this.videoChannel = videoChannel
        if (this.alreadyLoaded) this.videosList().reloadVideos()

        this.hooks.runAction('action:video-channel-videos.video-channel.loaded', 'video-channel', { videoChannel })

        this.alreadyLoaded = true
      })
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-videos.init', 'video-channel')
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()
  }

  getVideosObservable (pagination: ComponentPaginationLight, filters: VideoFilters) {
    return this.videoService.listChannelVideos({
      ...filters.toVideosAPIObject(),

      videoPagination: pagination,
      videoChannel: this.videoChannel,
      includeScheduledLive: true,
      skipCount: true
    })
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
