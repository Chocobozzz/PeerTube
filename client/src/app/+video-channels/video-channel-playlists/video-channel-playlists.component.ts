import { Component, OnDestroy, OnInit } from '@angular/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { flatMap } from 'rxjs/operators'
import { Subscription } from 'rxjs'
import { Notifier } from '@app/core'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { VideoPlaylistService } from '@app/shared/video-playlist/video-playlist.service'

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

  private videoChannelSub: Subscription
  private videoChannel: VideoChannel

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
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
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadVideoPlaylists()
  }

  private loadVideoPlaylists () {
    this.authService.userInformationLoaded
        .pipe(flatMap(() => this.videoPlaylistService.listChannelPlaylists(this.videoChannel)))
        .subscribe(res => {
          this.videoPlaylists = this.videoPlaylists.concat(res.data)
          this.pagination.totalItems = res.total
        })
  }
}
