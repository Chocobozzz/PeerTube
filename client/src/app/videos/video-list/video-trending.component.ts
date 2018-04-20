import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { immutableAssign } from '@app/shared/misc/utils'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoSortField } from '../../shared/video/sort-field.type'
import { VideoService } from '../../shared/video/video.service'

@Component({
  selector: 'my-videos-trending',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoTrendingComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage = 'Trending'
  currentRoute = '/videos/trending'
  defaultSort: VideoSortField = '-views'

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected notificationsService: NotificationsService,
               protected authService: AuthService,
               protected location: Location,
               private videoService: VideoService) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()

    this.generateSyndicationList()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    return this.videoService.getVideos(newPagination, this.sort)
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoFeedUrls(this.sort)
  }
}
