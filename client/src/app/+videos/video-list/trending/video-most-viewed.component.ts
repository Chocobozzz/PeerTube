import { Component, ComponentFactoryResolver, Injector, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, LocalStorageService, Notifier, ScreenService, ServerService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { immutableAssign } from '@app/helpers'
import { VideoService } from '@app/shared/shared-main'
import { AbstractVideoList } from '@app/shared/shared-video-miniature'
import { VideoSortField } from '@shared/models'
import { VideoTrendingHeaderComponent } from './video-trending-header.component'

@Component({
  selector: 'my-videos-most-viewed',
  styleUrls: [ '../../../shared/shared-video-miniature/abstract-video-list.scss' ],
  templateUrl: '../../../shared/shared-video-miniature/abstract-video-list.html'
})
export class VideoMostViewedComponent extends AbstractVideoList implements OnInit, OnDestroy {
  HeaderComponent = VideoTrendingHeaderComponent
  titlePage: string
  defaultSort: VideoSortField = '-trending'

  useUserVideoPreferences = true

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
    private hooks: HooksService
  ) {
    super()

    this.headerComponentInjector = this.getInjector()
  }

  ngOnInit () {
    super.ngOnInit()

    this.generateSyndicationList()

    this.serverService.getConfig().subscribe(
      config => {
        const trendingDays = config.trending.videos.intervalDays

        if (trendingDays === 1) {
          this.titleTooltip = $localize`Trending videos are those totalizing the greatest number of views during the last 24 hours`
        } else {
          this.titleTooltip = $localize`Trending videos are those totalizing the greatest number of views during the last ${trendingDays} days`
        }

        this.headerComponentInjector = this.getInjector()
        this.setHeader()
      })
  }

  ngOnDestroy () {
    super.ngOnDestroy()
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
}
