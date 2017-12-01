import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { VideoService } from '../shared'
import { AbstractVideoList } from './shared'

@Component({
  selector: 'my-videos-trending',
  styleUrls: [ './shared/abstract-video-list.scss' ],
  templateUrl: './shared/abstract-video-list.html'
})
export class VideoTrendingComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage = 'Trending'
  currentRoute = '/videos/trending'

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected notificationsService: NotificationsService,
               private videoService: VideoService) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngOnDestroy () {
    super.ngOnDestroy()
  }

  getVideosObservable () {
    return this.videoService.getVideos(this.pagination, this.sort)
  }
}
