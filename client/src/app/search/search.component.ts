import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService } from '@app/core'
import { NotificationsService } from 'angular2-notifications'
import { forkJoin, Subscription } from 'rxjs'
import { SearchService } from '@app/search/search.service'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { MetaService } from '@ngx-meta/core'
import { AdvancedSearch } from '@app/search/advanced-search.model'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { immutableAssign } from '@app/shared/misc/utils'
import { Video } from '@app/shared/video/video.model'

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
    private notificationsService: NotificationsService,
    private searchService: SearchService,
    private authService: AuthService
  ) { }

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

      err => this.notificationsService.error('Error', err.text)
    )
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
      this.searchService.searchVideos(this.currentSearch, this.pagination, this.advancedSearch),
      this.searchService.searchVideoChannels(this.currentSearch, immutableAssign(this.pagination, { itemsPerPage: this.channelsPerPage }))
    ])
      .subscribe(
        ([ videosResult, videoChannelsResult ]) => {
          this.results = this.results
                             .concat(videoChannelsResult.data)
                             .concat(videosResult.videos)
          this.pagination.totalItems = videosResult.totalVideos + videoChannelsResult.total

          // Focus on channels if there are no enough videos
          if (this.firstSearch === true && videosResult.videos.length < this.pagination.itemsPerPage) {
            this.resetPagination()
            this.firstSearch = false

            this.channelsPerPage = 10
            this.search()
          }

          this.firstSearch = false
        },

        error => {
          this.notificationsService.error(this.i18n('Error'), error.message)
        }
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

  private resetPagination () {
    this.pagination.currentPage = 1
    this.pagination.totalItems = null
    this.channelsPerPage = 2

    this.results = []
  }

  private updateTitle () {
    this.metaService.setTitle(this.i18n('Search') + ' ' + this.currentSearch)
  }

  private updateUrlFromAdvancedSearch () {
    const search = this.currentSearch || undefined

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.assign({}, this.advancedSearch.toUrlObject(), { search })
    })
  }
}
