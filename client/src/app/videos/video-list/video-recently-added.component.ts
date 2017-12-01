import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { VideoService } from '../../shared/video/video.service'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'

@Component({
  selector: 'my-videos-recently-added',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoRecentlyAddedComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage = 'Recently added'
  currentRoute = '/videos/recently-added'

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
