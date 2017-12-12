import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core/auth'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { SortField } from '../../shared/video/sort-field.type'
import { VideoService } from '../../shared/video/video.service'

@Component({
  selector: 'my-videos-trending',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoTrendingComponent extends AbstractVideoList implements OnInit {
  titlePage = 'Trending'
  currentRoute = '/videos/trending'
  defaultSort: SortField = '-views'

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected notificationsService: NotificationsService,
               protected authService: AuthService,
               private videoService: VideoService) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  getVideosObservable () {
    return this.videoService.getVideos(this.pagination, this.sort)
  }
}
