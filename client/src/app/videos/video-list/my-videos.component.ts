import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'

import { AbstractVideoList } from './shared'
import { VideoService } from '../shared'

@Component({
  selector: 'my-videos',
  styleUrls: [ './shared/abstract-video-list.scss' ],
  templateUrl: './shared/abstract-video-list.html'
})
export class MyVideosComponent extends AbstractVideoList implements OnInit, OnDestroy {

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected notificationsService: NotificationsService,
    private videoService: VideoService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()
  }

  ngOnDestroy () {
    this.subActivatedRoute.unsubscribe()
  }

  getVideosObservable () {
    return this.videoService.getMyVideos(this.pagination, this.sort)
  }
}
