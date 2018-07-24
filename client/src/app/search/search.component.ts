import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { RedirectService } from '@app/core'
import { NotificationsService } from 'angular2-notifications'
import { Subscription } from 'rxjs'
import { SearchService } from '@app/search/search.service'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Video } from '../../../../shared'
import { MetaService } from '@ngx-meta/core'
import { AdvancedSearch } from '@app/search/advanced-search.model'

@Component({
  selector: 'my-search',
  styleUrls: [ './search.component.scss' ],
  templateUrl: './search.component.html'
})
export class SearchComponent implements OnInit, OnDestroy {
  videos: Video[] = []
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10, // It's per object type (so 10 videos, 10 video channels etc)
    totalItems: null
  }
  advancedSearch: AdvancedSearch = new AdvancedSearch()
  isSearchFilterCollapsed = true

  private subActivatedRoute: Subscription
  private currentSearch: string
  private isInitialLoad = true

  constructor (
    private i18n: I18n,
    private route: ActivatedRoute,
    private router: Router,
    private metaService: MetaService,
    private redirectService: RedirectService,
    private notificationsService: NotificationsService,
    private searchService: SearchService
  ) { }

  ngOnInit () {
    this.subActivatedRoute = this.route.queryParams.subscribe(
      queryParams => {
        const querySearch = queryParams['search']

        // New empty search
        if (this.currentSearch && !querySearch) return this.redirectService.redirectToHomepage()

        // Search updated, reset filters
        if (this.currentSearch !== querySearch) {
          this.resetPagination()
          this.advancedSearch.reset()

          this.currentSearch = querySearch
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

  search () {
    return this.searchService.searchVideos(this.currentSearch, this.pagination, this.advancedSearch)
      .subscribe(
        ({ videos, totalVideos }) => {
          this.videos = this.videos.concat(videos)
          this.pagination.totalItems = totalVideos
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

  private resetPagination () {
    this.pagination.currentPage = 1
    this.pagination.totalItems = null

    this.videos = []
  }

  private updateTitle () {
    this.metaService.setTitle(this.i18n('Search') + ' ' + this.currentSearch)
  }

  private updateUrlFromAdvancedSearch () {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.assign({}, this.advancedSearch.toUrlObject(), { search: this.currentSearch })
    })
  }
}
