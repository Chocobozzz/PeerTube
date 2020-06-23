import { Subject, Subscription } from 'rxjs'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ComponentPagination, hasMoreItems } from '@app/core'
import { VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import { VideoPlaylist, VideoPlaylistService } from '@app/shared/shared-video-playlist'

@Component({
  selector: 'my-video-channel-playlists',
  templateUrl: './video-channel-playlists.component.html',
  styleUrls: [ './video-channel-playlists.component.scss' ]
})
export class VideoChannelPlaylistsComponent implements OnInit, OnDestroy {
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
    private videoChannelService: VideoChannelService
  ) {}

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelSub = this.videoChannelService.videoChannelLoaded
                               .subscribe(videoChannel => {
                                 this.videoChannel = videoChannel
                                 this.loadVideoPlaylists()
                               })
  }

  ngOnDestroy () {
    if (this.videoChannelSub) this.videoChannelSub.unsubscribe()
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1
    this.loadVideoPlaylists()
  }

  private loadVideoPlaylists () {
    this.videoPlaylistService.listChannelPlaylists(this.videoChannel, this.pagination)
        .subscribe(res => {
          this.videoPlaylists = this.videoPlaylists.concat(res.data)
          this.pagination.totalItems = res.total

          this.onDataSubject.next(res.data)
        })
  }
}
