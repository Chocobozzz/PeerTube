import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { RedirectService } from '@app/core'
import { immutableAssign } from '@app/shared/misc/utils'
import { NotificationsService } from 'angular2-notifications'
import { Subscription } from 'rxjs/Subscription'
import { AuthService } from '../../core/auth'
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

  protected otherRouteParams = {
    search: ''
  }
  private subActivatedRoute: Subscription

  constructor (protected router: Router,
               protected route: ActivatedRoute,
               protected notificationsService: NotificationsService,
               protected authService: AuthService,
               private videoService: VideoService,
               private redirectService: RedirectService
  ) {
    super()
  }

  ngOnInit () {
    super.ngOnInit()

    this.subActivatedRoute = this.route.queryParams.subscribe(
      queryParams => {
        const querySearch = queryParams['search']

        if (!querySearch) return this.redirectService.redirectToHomepage()
        if (this.otherRouteParams.search === querySearch) return

        this.otherRouteParams.search = querySearch
        this.reloadVideos()
      },

      err => this.notificationsService.error('Error', err.text)
    )
  }

  ngOnDestroy () {
    super.ngOnDestroy()

    if (this.subActivatedRoute) this.subActivatedRoute.unsubscribe()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    return this.videoService.searchVideos(this.otherRouteParams.search, newPagination, this.sort)
  }
}
