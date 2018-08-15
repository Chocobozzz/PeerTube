import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { RedirectService, ServerService } from '@app/core'
import { NotificationsService } from 'angular2-notifications'
import { SearchService } from '@app/search/search.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { MetaService } from '@ngx-meta/core'
import { AdvancedSearch } from '@app/search/advanced-search.model'
import { VideoConstant } from '../../../../shared'

@Component({
  selector: 'my-search-filters',
  styleUrls: [ './search-filters.component.scss' ],
  templateUrl: './search-filters.component.html'
})
export class SearchFiltersComponent implements OnInit {
  @Input() advancedSearch: AdvancedSearch = new AdvancedSearch()

  @Output() filtered = new EventEmitter<AdvancedSearch>()

  videoCategories: VideoConstant<string>[] = []
  videoLicences: VideoConstant<string>[] = []
  videoLanguages: VideoConstant<string>[] = []

  publishedDateRanges: { id: string, label: string }[] = []
  sorts: { id: string, label: string }[] = []
  durationRanges: { id: string, label: string }[] = []

  publishedDateRange: string
  durationRange: string

  constructor (
    private i18n: I18n,
    private route: ActivatedRoute,
    private metaService: MetaService,
    private redirectService: RedirectService,
    private notificationsService: NotificationsService,
    private searchService: SearchService,
    private serverService: ServerService
  ) {
    this.publishedDateRanges = [
      {
        id: 'today',
        label: this.i18n('Today')
      },
      {
        id: 'last_7days',
        label: this.i18n('Last 7 days')
      },
      {
        id: 'last_30days',
        label: this.i18n('Last 30 days')
      },
      {
        id: 'last_365days',
        label: this.i18n('Last 365 days')
      }
    ]

    this.durationRanges = [
      {
        id: 'short',
        label: this.i18n('Short (< 4 min)')
      },
      {
        id: 'long',
        label: this.i18n('Long (> 10 min)')
      },
      {
        id: 'medium',
        label: this.i18n('Medium (4-10 min)')
      }
    ]

    this.sorts = [
      {
        id: '-match',
        label: this.i18n('Relevance')
      },
      {
        id: '-publishedAt',
        label: this.i18n('Publish date')
      },
      {
        id: '-views',
        label: this.i18n('Views')
      }
    ]
  }

  ngOnInit () {
    this.videoCategories = this.serverService.getVideoCategories()
    this.videoLicences = this.serverService.getVideoLicences()
    this.videoLanguages = this.serverService.getVideoLanguages()

    this.loadFromDurationRange()
    this.loadFromPublishedRange()
  }

  formUpdated () {
    this.updateModelFromDurationRange()
    this.updateModelFromPublishedRange()

    this.filtered.emit(this.advancedSearch)
  }

  private loadFromDurationRange () {
    if (this.advancedSearch.durationMin || this.advancedSearch.durationMax) {
      const fourMinutes = 60 * 4
      const tenMinutes = 60 * 10

      if (this.advancedSearch.durationMin === fourMinutes && this.advancedSearch.durationMax === tenMinutes) {
        this.durationRange = 'medium'
      } else if (this.advancedSearch.durationMax === fourMinutes) {
        this.durationRange = 'short'
      } else if (this.advancedSearch.durationMin === tenMinutes) {
        this.durationRange = 'long'
      }
    }
  }

  private loadFromPublishedRange () {
    if (this.advancedSearch.startDate) {
      const date = new Date(this.advancedSearch.startDate)
      const now = new Date()

      const diff = Math.abs(date.getTime() - now.getTime())

      const dayMS = 1000 * 3600 * 24
      const numberOfDays = diff / dayMS

      if (numberOfDays >= 365) this.publishedDateRange = 'last_365days'
      else if (numberOfDays >= 30) this.publishedDateRange = 'last_30days'
      else if (numberOfDays >= 7) this.publishedDateRange = 'last_7days'
      else if (numberOfDays >= 0) this.publishedDateRange = 'today'
    }
  }

  private updateModelFromDurationRange () {
    if (!this.durationRange) return

    const fourMinutes = 60 * 4
    const tenMinutes = 60 * 10

    switch (this.durationRange) {
      case 'short':
        this.advancedSearch.durationMin = undefined
        this.advancedSearch.durationMax = fourMinutes
        break

      case 'medium':
        this.advancedSearch.durationMin = fourMinutes
        this.advancedSearch.durationMax = tenMinutes
        break

      case 'long':
        this.advancedSearch.durationMin = tenMinutes
        this.advancedSearch.durationMax = undefined
        break
    }
  }

  private updateModelFromPublishedRange () {
    if (!this.publishedDateRange) return

    // today
    const date = new Date()
    date.setHours(0, 0, 0, 0)

    switch (this.publishedDateRange) {
      case 'last_7days':
        date.setDate(date.getDate() - 7)
        break

      case 'last_30days':
        date.setDate(date.getDate() - 30)
        break

      case 'last_365days':
        date.setDate(date.getDate() - 365)
        break
    }

    this.advancedSearch.startDate = date.toISOString()
  }
}
