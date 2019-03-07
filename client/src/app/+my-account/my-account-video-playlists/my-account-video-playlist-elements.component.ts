import { Component, OnDestroy, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { AuthService } from '../../core/auth'
import { ConfirmService } from '../../core/confirm'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { Video } from '@app/shared/video/video.model'
import { Subscription } from 'rxjs'
import { ActivatedRoute } from '@angular/router'
import { VideoService } from '@app/shared/video/video.service'

@Component({
  selector: 'my-account-video-playlist-elements',
  templateUrl: './my-account-video-playlist-elements.component.html',
  styleUrls: [ './my-account-video-playlist-elements.component.scss' ]
})
export class MyAccountVideoPlaylistElementsComponent implements OnInit, OnDestroy {
  videos: Video[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }

  private videoPlaylistId: string | number
  private paramsSub: Subscription

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private route: ActivatedRoute,
    private videoService: VideoService
  ) {}

  ngOnInit () {
    this.paramsSub = this.route.params.subscribe(routeParams => {
      this.videoPlaylistId = routeParams[ 'videoPlaylistId' ]
      this.loadElements()
    })
  }

  ngOnDestroy () {
    if (this.paramsSub) this.paramsSub.unsubscribe()
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.loadElements()
  }

  private loadElements () {
    this.videoService.getPlaylistVideos(this.videoPlaylistId, this.pagination)
        .subscribe(({ totalVideos, videos }) => {
          this.videos = this.videos.concat(videos)
          this.pagination.totalItems = totalVideos
        })
  }
}
