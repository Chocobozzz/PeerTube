import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { Subscription } from 'rxjs/Subscription'
import { AbstractVideoList } from '../../shared/video/abstract-video-list'
import { VideoService } from '../../shared/video/video.service'

@Component({
  selector: 'my-videos-search',
  styleUrls: [ '../../shared/video/abstract-video-list.scss' ],
  templateUrl: '../../shared/video/abstract-video-list.html'
})
export class VideoSearchComponent extends AbstractVideoList implements OnInit, OnDestroy {
  titlePage = 'Search'
  currentRoute = '/videos/search'
  loadOnInit = false

  private search = ''
  private subActivatedRoute: Subscription

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected notificationsService: NotificationsService,
               private videoService: VideoService) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()

    this.subActivatedRoute = this.route.queryParams.subscribe(
      queryParams => {
        this.search = queryParams['search']
        this.reloadVideos()
      },

      err => this.notificationsService.error('Error', err.text)
    )
  }

  ngOnDestroy () {
    if (this.subActivatedRoute) {
      this.subActivatedRoute.unsubscribe()
    }
  }

  getVideosObservable () {
    return this.videoService.searchVideos(this.search, this.pagination, this.sort)
  }
}
