import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ComponentPaginationLight, DisableForReuseHook, MetaService, ServerService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { VideoFilterScope, VideoFilters } from '@app/shared/shared-video-miniature/video-filters.model'
import { VideoSortField } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { VideosListComponent } from '../../shared/shared-video-miniature/videos-list.component'

@Component({
  templateUrl: './videos-list-all.component.html',
  standalone: true,
  imports: [
    VideosListComponent
  ]
})
export class VideosListAllComponent implements OnInit, OnDestroy, DisableForReuseHook {
  getVideosObservableFunction = this.getVideosObservable.bind(this)
  getSyndicationItemsFunction = this.getSyndicationItems.bind(this)

  title: string
  titleTooltip: string

  groupByDate: boolean

  defaultSort: VideoSortField
  defaultScope: VideoFilterScope

  loadUserVideoPreferences = true

  displayFilters = true

  disabled = false

  private routeSub: Subscription

  constructor (
    private server: ServerService,
    private route: ActivatedRoute,
    private videoService: VideoService,
    private hooks: HooksService,
    private meta: MetaService
  ) {
  }

  ngOnInit () {
    this.defaultSort = '-publishedAt'
    this.defaultScope = 'federated'

    this.routeSub = this.route.params.subscribe(() => this.update())
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  getVideosObservable (pagination: ComponentPaginationLight, filters: VideoFilters) {
    const params = {
      ...filters.toVideosAPIObject(),

      videoPagination: { ...pagination },
      skipCount: true
    }

    return this.hooks.wrapObsFun(
      this.videoService.getVideos.bind(this.videoService),
      params,
      'common',
      'filter:api.browse-videos.videos.list.params',
      'filter:api.browse-videos.videos.list.result'
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

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  update () {
    this.buildTitle()
    this.updateGroupByDate(this.defaultSort)

    this.meta.setTitle(this.title)
  }

  private updateGroupByDate (sort: VideoSortField) {
    this.groupByDate = sort === '-publishedAt' || sort === 'publishedAt'
  }

  private buildTitle (scope: VideoFilterScope = this.defaultScope, sort: VideoSortField = this.defaultSort) {
    const trendingDays = this.server.getHTMLConfig().trending.videos.intervalDays
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
        if (trendingDays === 1) {
          this.titleTooltip = $localize`Videos with the most views during the last 24 hours`
          return
        }

        this.titleTooltip = $localize`Videos with the most views during the last ${trendingDays} days`
      }

      return
    }
  }

  private getSanitizedSort (sort: VideoSortField) {
    return sort.replace(/^-/, '') as VideoSortField
  }
}
