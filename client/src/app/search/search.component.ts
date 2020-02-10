import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, Notifier } from '@app/core'
import { forkJoin, of, Subscription } from 'rxjs'
import { SearchService } from '@app/search/search.service'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { MetaService } from '@ngx-meta/core'
import { AdvancedSearch } from '@app/search/advanced-search.model'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { immutableAssign } from '@app/shared/misc/utils'
import { Video } from '@app/shared/video/video.model'
import { HooksService } from '@app/core/plugins/hooks.service'

@Component({
  selector: 'my-search',
  styleUrls: [ './search.component.scss' ],
  templateUrl: './search.component.html'
})
export class SearchComponent implements OnInit, OnDestroy {
  results: (Video | VideoChannel)[] = []

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10, // Only for videos, use another variable for channels
    totalItems: null
  }
  advancedSearch: AdvancedSearch = new AdvancedSearch()
  isSearchFilterCollapsed = true
  currentSearch: string

  private subActivatedRoute: Subscription
  private isInitialLoad = false // set to false to show the search filters on first arrival
  private firstSearch = true

  private channelsPerPage = 2

  constructor (
    private i18n: I18n,
    private route: ActivatedRoute,
    private router: Router,
    private metaService: MetaService,
    private notifier: Notifier,
    private searchService: SearchService,
    private authService: AuthService,
    private hooks: HooksService
  ) { }

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.subActivatedRoute = this.route.queryParams.subscribe(
      queryParams => {
        const querySearch = queryParams['search']

        // Search updated, reset filters
        if (this.currentSearch !== querySearch) {
          this.resetPagination()
          this.advancedSearch.reset()

          this.currentSearch = querySearch || undefined
          this.updateTitle()
        }

        this.advancedSearch = new AdvancedSearch(queryParams)

        // Don't hide filters if we have some of them AND the user just came on the webpage
        this.isSearchFilterCollapsed = this.isInitialLoad === false || !this.advancedSearch.containsValues()
        this.isInitialLoad = false

        this.search()
      },

      err => this.notifier.error(err.text)
    )

    this.hooks.runAction('action:search.init', 'search')
  }

  ngOnDestroy () {
    if (this.subActivatedRoute) this.subActivatedRoute.unsubscribe()
  }

  isVideoChannel (d: VideoChannel | Video): d is VideoChannel {
    return d instanceof VideoChannel
  }

  isVideo (v: VideoChannel | Video): v is Video {
    return v instanceof Video
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  search () {
    forkJoin([
      this.getVideosObs(),
      this.getVideoChannelObs()
    ])
      .subscribe(
        ([ videosResult, videoChannelsResult ]) => {
          this.results = this.results
                             .concat(videoChannelsResult.data)
                             .concat(videosResult.data)
          this.pagination.totalItems = videosResult.total + videoChannelsResult.total

          // Focus on channels if there are no enough videos
          if (this.firstSearch === true && videosResult.data.length < this.pagination.itemsPerPage) {
            this.resetPagination()
            this.firstSearch = false

            this.channelsPerPage = 10
            this.search()
          }

          this.firstSearch = false
        },

        err => this.notifier.error(err.message)
      )
  }

  onNearOfBottom () {
    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1
    this.search()
  }

  onFiltered () {
    this.resetPagination()

    this.updateUrlFromAdvancedSearch()
  }

  numberOfFilters () {
    return this.advancedSearch.size()
  }

  // Add VideoChannel for typings, but the template already checks "video" argument is a video
  removeVideoFromArray (video: Video | VideoChannel) {
    this.results = this.results.filter(r => !this.isVideo(r) || r.id !== video.id)
  }

  private resetPagination () {
    this.pagination.currentPage = 1
    this.pagination.totalItems = null
    this.channelsPerPage = 2

    this.results = []
  }

  private updateTitle () {
    const suffix = this.currentSearch ? ' ' + this.currentSearch : ''
    this.metaService.setTitle(this.i18n('Search') + suffix)
  }

  private updateUrlFromAdvancedSearch () {
    const search = this.currentSearch || undefined

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.assign({}, this.advancedSearch.toUrlObject(), { search })
    })
  }

  private getVideosObs () {
    const params = {
      search: this.currentSearch,
      componentPagination: this.pagination,
      advancedSearch: this.advancedSearch
    }

    return this.hooks.wrapObsFun(
      this.searchService.searchVideos.bind(this.searchService),
      params,
      'search',
      'filter:api.search.videos.list.params',
      'filter:api.search.videos.list.result'
    )
  }

  private getVideoChannelObs () {
    if (!this.currentSearch) return of({ data: [], total: 0 })

    const params = {
      search: this.currentSearch,
      componentPagination: immutableAssign(this.pagination, { itemsPerPage: this.channelsPerPage })
    }

    return this.hooks.wrapObsFun(
      this.searchService.searchVideoChannels.bind(this.searchService),
      params,
      'search',
      'filter:api.search.video-channels.list.params',
      'filter:api.search.video-channels.list.result'
    )
  }
}
