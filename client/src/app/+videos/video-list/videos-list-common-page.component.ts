import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router'
import { ComponentPaginationLight, DisableForReuseHook, MetaService, RedirectService, ServerService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { VideoService } from '@app/shared/shared-main'
import { VideoFilters, VideoFilterScope } from '@app/shared/shared-video-miniature/video-filters.model'
import { ClientFilterHookName, VideoSortField } from '@shared/models'
import { Subscription } from 'rxjs'

export type VideosListCommonPageRouteData = {
  sort: VideoSortField

  scope: VideoFilterScope
  hookParams: ClientFilterHookName
  hookResult: ClientFilterHookName
}

@Component({
  templateUrl: './videos-list-common-page.component.html'
})
export class VideosListCommonPageComponent implements OnInit, OnDestroy, DisableForReuseHook {
  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)
  baseRouteBuilderFunction = this.baseRouteBuilder.bind(this)

  title: string
  titleTooltip: string

  groupByDate: boolean

  defaultSort: VideoSortField
  defaultScope: VideoFilterScope

  hookParams: ClientFilterHookName
  hookResult: ClientFilterHookName

  loadUserVideoPreferences = true

  displayFilters = true

  disabled = false

  private trendingDays: number
  private routeSub: Subscription

  constructor (
    private server: ServerService,
    private route: ActivatedRoute,
    private videoService: VideoService,
    private hooks: HooksService,
    private meta: MetaService,
    private redirectService: RedirectService
  ) {
  }

  ngOnInit () {
    this.trendingDays = this.server.getHTMLConfig().trending.videos.intervalDays

    this.routeSub = this.route.params.subscribe(params => {
      this.update(params['page'])
    })
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  getVideosObservable (pagination: ComponentPaginationLight, filters: VideoFilters) {
    const params = {
      ...filters.toVideosAPIObject(),

      videoPagination: pagination,
      skipCount: true
    }

    return this.hooks.wrapObsFun(
      this.videoService.getVideos.bind(this.videoService),
      params,
      'common',
      this.hookParams,
      this.hookResult
    )
  }

  getSyndicationItems (filters: VideoFilters) {
    const result = filters.toVideosAPIObject()

    return this.videoService.getVideoFeedUrls(result.sort, result.isLocal)
  }

  onFiltersChanged (filters: VideoFilters) {
    this.buildTitle(filters.scope, filters.sort)
    this.updateGroupByDate(filters.sort)
  }

  baseRouteBuilder (filters: VideoFilters) {
    const sanitizedSort = this.getSanitizedSort(filters.sort)

    let suffix: string

    if (filters.scope === 'local') suffix = 'local'
    else if (sanitizedSort === 'publishedAt') suffix = 'recently-added'
    else suffix = 'trending'

    return [ '/videos', suffix ]
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  update (page: string) {
    const data = this.getData(page)

    this.hookParams = data.hookParams
    this.hookResult = data.hookResult

    this.defaultSort = data.sort
    this.defaultScope = data.scope

    this.buildTitle()
    this.updateGroupByDate(this.defaultSort)

    this.meta.setTitle(this.title)
  }

  private getData (page: string) {
    if (page === 'trending') return this.generateTrendingData(this.route.snapshot)

    if (page === 'local') return this.generateLocalData()

    return this.generateRecentlyAddedData()
  }

  private generateRecentlyAddedData (): VideosListCommonPageRouteData {
    return {
      sort: '-publishedAt',
      scope: 'federated',
      hookParams: 'filter:api.recently-added-videos.videos.list.params',
      hookResult: 'filter:api.recently-added-videos.videos.list.result'
    }
  }

  private generateLocalData (): VideosListCommonPageRouteData {
    return {
      sort: '-publishedAt' as VideoSortField,
      scope: 'local',
      hookParams: 'filter:api.local-videos.videos.list.params',
      hookResult: 'filter:api.local-videos.videos.list.result'
    }
  }

  private generateTrendingData (route: ActivatedRouteSnapshot): VideosListCommonPageRouteData {
    const sort = route.queryParams['sort'] ?? this.parseTrendingAlgorithm(this.redirectService.getDefaultTrendingAlgorithm())

    return {
      sort,
      scope: 'federated',
      hookParams: 'filter:api.trending-videos.videos.list.params',
      hookResult: 'filter:api.trending-videos.videos.list.result'
    }
  }

  private parseTrendingAlgorithm (algorithm: string): VideoSortField {
    switch (algorithm) {
      case 'most-viewed':
        return '-trending'

      case 'most-liked':
        return '-likes'

      // We'll automatically apply "best" sort if using "hot" sort with a logged user
      case 'best':
        return '-hot'

      default:
        return '-' + algorithm as VideoSortField
    }
  }

  private updateGroupByDate (sort: VideoSortField) {
    this.groupByDate = sort === '-publishedAt' || sort === 'publishedAt'
  }

  private buildTitle (scope: VideoFilterScope = this.defaultScope, sort: VideoSortField = this.defaultSort) {
    const sanitizedSort = this.getSanitizedSort(sort)

    if (scope === 'local') {
      this.title = $localize`Local videos`
      this.titleTooltip = $localize`Only videos uploaded on this instance are displayed`
      return
    }

    if (sanitizedSort === 'publishedAt') {
      this.title = $localize`Recently added`
      this.titleTooltip = undefined
      return
    }

    if ([ 'hot', 'trending', 'likes', 'views' ].includes(sanitizedSort)) {
      this.title = $localize`Trending`

      if (sanitizedSort === 'hot') {
        this.titleTooltip = $localize`Videos with the most interactions for recent videos`
        return
      }

      if (sanitizedSort === 'likes') {
        this.titleTooltip = $localize`Videos that have the most likes`
        return
      }

      if (sanitizedSort === 'views') {
        this.titleTooltip = undefined
        return
      }

      if (sanitizedSort === 'trending') {
        if (this.trendingDays === 1) {
          this.titleTooltip = $localize`Videos with the most views during the last 24 hours`
          return
        }

        this.titleTooltip = $localize`Videos with the most views during the last ${this.trendingDays} days`
      }

      return
    }
  }

  private getSanitizedSort (sort: VideoSortField) {
    return sort.replace(/^-/, '') as VideoSortField
  }
}
