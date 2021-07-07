import { Subscription } from 'rxjs'
import { first, switchMap } from 'rxjs/operators'
import { Component, ComponentFactoryResolver, Injector, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { AuthService, LocalStorageService, Notifier, RedirectService, ScreenService, ServerService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { immutableAssign } from '@app/helpers'
import { VideoService } from '@app/shared/shared-main'
import { AbstractVideoList } from '@app/shared/shared-video-miniature'
import { VideoSortField } from '@shared/models'
import { VideoTrendingHeaderComponent } from './video-trending-header.component'

@Component({
  selector: 'my-videos-hot',
  styleUrls: [ '../../../shared/shared-video-miniature/abstract-video-list.scss' ],
  templateUrl: '../../../shared/shared-video-miniature/abstract-video-list.html'
})
export class VideoTrendingComponent extends AbstractVideoList implements OnInit, OnDestroy {
  HeaderComponent = VideoTrendingHeaderComponent
  titlePage: string
  defaultSort: VideoSortField = '-trending'

  loadUserVideoPreferences = true

  private algorithmChangeSub: Subscription

  constructor (
    protected router: Router,
    protected serverService: ServerService,
    protected route: ActivatedRoute,
    protected notifier: Notifier,
    protected authService: AuthService,
    protected userService: UserService,
    protected screenService: ScreenService,
    protected storageService: LocalStorageService,
    protected cfr: ComponentFactoryResolver,
    private videoService: VideoService,
    private redirectService: RedirectService,
    private hooks: HooksService
  ) {
    super()

    this.defaultSort = this.parseAlgorithm(this.redirectService.getDefaultTrendingAlgorithm())

    this.headerComponentInjector = this.getInjector()
  }

  ngOnInit () {
    super.ngOnInit()

    this.generateSyndicationList()

    // Subscribe to alg change after we loaded the data
    // The initial alg load is handled by the parent class
    this.algorithmChangeSub = this.onDataSubject
      .pipe(
        first(),
        switchMap(() => this.route.queryParams)
      ).subscribe(queryParams => {
        const oldSort = this.sort

        this.loadPageRouteParams(queryParams)

        if (oldSort !== this.sort) this.reloadVideos()
      }
    )
  }

  ngOnDestroy () {
    super.ngOnDestroy()
    if (this.algorithmChangeSub) this.algorithmChangeSub.unsubscribe()
  }

  getVideosObservable (page: number) {
    const newPagination = immutableAssign(this.pagination, { currentPage: page })
    const params = {
      videoPagination: newPagination,
      sort: this.sort,
      categoryOneOf: this.categoryOneOf,
      languageOneOf: this.languageOneOf,
      nsfwPolicy: this.nsfwPolicy,
      skipCount: true
    }

    return this.hooks.wrapObsFun(
      this.videoService.getVideos.bind(this.videoService),
      params,
      'common',
      'filter:api.trending-videos.videos.list.params',
      'filter:api.trending-videos.videos.list.result'
    )
  }

  generateSyndicationList () {
    this.syndicationItems = this.videoService.getVideoFeedUrls(this.sort, undefined, this.categoryOneOf)
  }

  getInjector () {
    return Injector.create({
      providers: [{
        provide: 'data',
        useValue: {
          model: this.defaultSort
        }
      }]
    })
  }

  protected loadPageRouteParams (queryParams: Params) {
    const algorithm = queryParams['alg'] || this.redirectService.getDefaultTrendingAlgorithm()

    this.sort = this.parseAlgorithm(algorithm)
  }

  private parseAlgorithm (algorithm: string): VideoSortField {
    switch (algorithm) {
      case 'most-viewed':
        return '-trending'

      case 'most-liked':
        return '-likes'

      default:
        return '-' + algorithm as VideoSortField
    }
  }
}
