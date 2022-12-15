import { Subject, Subscription } from 'rxjs'
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core'
import { ComponentPagination, hasMoreItems, HooksService, ScreenService } from '@app/core'
import { VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { VideoPlaylist, VideoPlaylistService } from '@app/shared/shared-video-playlist'

@Component({
  selector: 'my-video-channel-playlists',
  templateUrl: './video-channel-playlists.component.html',
  styleUrls: [ './video-channel-playlists.component.scss' ]
})
export class VideoChannelPlaylistsComponent implements OnInit, AfterViewInit, OnDestroy {
  videoPlaylists: VideoPlaylist[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: null
  }

  onDataSubject = new Subject<any[]>()

  private videoChannelSub: Subscription
  private videoChannel: VideoChannel

  constructor (
    private videoPlaylistService: VideoPlaylistService,
    private videoChannelService: VideoChannelService,
    private screenService: ScreenService,
    private hooks: HooksService
  ) {}

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
      .subscribe(videoChannel => {
        this.videoChannel = videoChannel

        this.hooks.runAction('action:video-channel-playlists.video-channel.loaded', 'video-channel', { videoChannel })

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
    this.videoPlaylistService.listChannelPlaylists(this.videoChannel, this.pagination)
      .subscribe(res => {
        this.videoPlaylists = this.videoPlaylists.concat(res.data)
        this.pagination.totalItems = res.total

        this.hooks.runAction('action:video-channel-playlists.playlists.loaded', 'video-channel', { playlists: this.videoPlaylists })

        this.onDataSubject.next(res.data)
      })
  }
}
