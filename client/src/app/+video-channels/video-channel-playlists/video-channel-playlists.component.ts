import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core'
import { ComponentPagination, hasMoreItems, HooksService, resetCurrentPage, ScreenService } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { Subject, Subscription } from 'rxjs'
import { InfiniteScrollerDirective } from '../../shared/shared-main/common/infinite-scroller.directive'
import { VideoPlaylistMiniatureComponent } from '../../shared/shared-video-playlist/video-playlist-miniature.component'

@Component({
  selector: 'my-video-channel-playlists',
  templateUrl: './video-channel-playlists.component.html',
  styleUrls: [ './video-channel-playlists.component.scss' ],
  imports: [ InfiniteScrollerDirective, VideoPlaylistMiniatureComponent ]
})
export class VideoChannelPlaylistsComponent implements OnInit, AfterViewInit, OnDestroy {
  private videoPlaylistService = inject(VideoPlaylistService)
  private videoChannelService = inject(VideoChannelService)
  private screenService = inject(ScreenService)
  private hooks = inject(HooksService)

  videoPlaylists: VideoPlaylist[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  private videoChannelSub: Subscription
  private videoChannel: VideoChannel

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
      .subscribe(videoChannel => {
        this.videoChannel = videoChannel

        this.hooks.runAction('action:video-channel-playlists.video-channel.loaded', 'video-channel', { videoChannel })

        this.videoPlaylists = []
        resetCurrentPage(this.pagination)
        this.loadVideoPlaylists()
      })
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:video-channel-playlists.init', 'video-channel')
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1
    this.loadVideoPlaylists()
  }

  displayAsRow () {
    return this.screenService.isInMobileView()
  }

  private loadVideoPlaylists () {
    this.videoPlaylistService.listChannelPlaylists({
      videoChannel: this.videoChannel,
      componentPagination: this.pagination,
      sort: 'videoChannelPosition'
    }).subscribe(res => {
      this.videoPlaylists = this.videoPlaylists.concat(res.data)
      this.pagination.totalItems = res.total

      this.hooks.runAction('action:video-channel-playlists.playlists.loaded', 'video-channel', { playlists: this.videoPlaylists })

      this.onDataSubject.next(res.data)
    })
  }
}
