import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { RedirectService } from '@app/core'
import { NotificationsService } from 'angular2-notifications'
import { Subscription } from 'rxjs'
import { SearchService } from '@app/search/search.service'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Video } from '../../../../shared'
import { MetaService } from '@ngx-meta/core'

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

  private subActivatedRoute: Subscription
  private currentSearch: string

  constructor (
    private i18n: I18n,
    private route: ActivatedRoute,
    private metaService: MetaService,
    private redirectService: RedirectService,
    private notificationsService: NotificationsService,
    private searchService: SearchService
  ) { }

  ngOnInit () {
    this.subActivatedRoute = this.route.queryParams.subscribe(
      queryParams => {
        const querySearch = queryParams['search']

        if (!querySearch) return this.redirectService.redirectToHomepage()
        if (querySearch === this.currentSearch) return

        this.currentSearch = querySearch
        this.updateTitle()

        this.reload()
      },

      err => this.notificationsService.error('Error', err.text)
    )
  }

  ngOnDestroy () {
    if (this.subActivatedRoute) this.subActivatedRoute.unsubscribe()
  }

  search () {
    return this.searchService.searchVideos(this.currentSearch, this.pagination)
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

  private reload () {
    this.pagination.currentPage = 1
    this.pagination.totalItems = null

    this.videos = []

    this.search()
  }

  private updateTitle () {
    this.metaService.setTitle(this.i18n('Search') + ' ' + this.currentSearch)
  }
}
