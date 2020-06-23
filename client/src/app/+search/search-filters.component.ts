import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { ValidatorFn } from '@angular/forms'
import { ServerService } from '@app/core'
import { VideoValidatorsService } from '@app/shared/shared-forms'
import { AdvancedSearch } from '@app/shared/shared-search'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ServerConfig, VideoConstant } from '@shared/models'

@Component({
  selector: 'my-search-filters',
  styleUrls: [ './search-filters.component.scss' ],
  templateUrl: './search-filters.component.html'
})
export class SearchFiltersComponent implements OnInit {
  @Input() advancedSearch: AdvancedSearch = new AdvancedSearch()

  @Output() filtered = new EventEmitter<AdvancedSearch>()

  videoCategories: VideoConstant<number>[] = []
  videoLicences: VideoConstant<number>[] = []
  videoLanguages: VideoConstant<string>[] = []

  tagValidators: ValidatorFn[]
  tagValidatorsMessages: { [ name: string ]: string }

  publishedDateRanges: { id: string, label: string }[] = []
  sorts: { id: string, label: string }[] = []
  durationRanges: { id: string, label: string }[] = []

  publishedDateRange: string
  durationRange: string

  originallyPublishedStartYear: string
  originallyPublishedEndYear: string

  private serverConfig: ServerConfig

  constructor (
    private i18n: I18n,
    private videoValidatorsService: VideoValidatorsService,
    private serverService: ServerService
  ) {
    this.tagValidators = this.videoValidatorsService.VIDEO_TAGS.VALIDATORS
    this.tagValidatorsMessages = this.videoValidatorsService.VIDEO_TAGS.MESSAGES
    this.publishedDateRanges = [
      {
        id: 'any_published_date',
        label: this.i18n('Any')
      },
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
        id: 'any_duration',
        label: this.i18n('Any')
      },
      {
        id: 'short',
        label: this.i18n('Short (< 4 min)')
      },
      {
        id: 'medium',
        label: this.i18n('Medium (4-10 min)')
      },
      {
        id: 'long',
        label: this.i18n('Long (> 10 min)')
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
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.serverService.getVideoCategories().subscribe(categories => this.videoCategories = categories)
    this.serverService.getVideoLicences().subscribe(licences => this.videoLicences = licences)
    this.serverService.getVideoLanguages().subscribe(languages => this.videoLanguages = languages)

    this.loadFromDurationRange()
    this.loadFromPublishedRange()
    this.loadOriginallyPublishedAtYears()
  }

  inputUpdated () {
    this.updateModelFromDurationRange()
    this.updateModelFromPublishedRange()
    this.updateModelFromOriginallyPublishedAtYears()
  }

  formUpdated () {
    this.inputUpdated()
    this.filtered.emit(this.advancedSearch)
  }

  reset () {
    this.advancedSearch.reset()
    this.durationRange = undefined
    this.publishedDateRange = undefined
    this.originallyPublishedStartYear = undefined
    this.originallyPublishedEndYear = undefined
    this.inputUpdated()
  }

  resetField (fieldName: string, value?: any) {
    this.advancedSearch[fieldName] = value
  }

  resetLocalField (fieldName: string, value?: any) {
    this[fieldName] = value
    this.inputUpdated()
  }

  resetOriginalPublicationYears () {
    this.originallyPublishedStartYear = this.originallyPublishedEndYear = undefined
  }

  isSearchTargetEnabled () {
    return this.serverConfig.search.searchIndex.enabled && this.serverConfig.search.searchIndex.disableLocalSearch !== true
  }

  private loadOriginallyPublishedAtYears () {
    this.originallyPublishedStartYear = this.advancedSearch.originallyPublishedStartDate
      ? new Date(this.advancedSearch.originallyPublishedStartDate).getFullYear().toString()
      : null

    this.originallyPublishedEndYear = this.advancedSearch.originallyPublishedEndDate
      ? new Date(this.advancedSearch.originallyPublishedEndDate).getFullYear().toString()
      : null
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

  private updateModelFromOriginallyPublishedAtYears () {
    const baseDate = new Date()
    baseDate.setHours(0, 0, 0, 0)
    baseDate.setMonth(0, 1)

    if (this.originallyPublishedStartYear) {
      const year = parseInt(this.originallyPublishedStartYear, 10)
      const start = new Date(baseDate)
      start.setFullYear(year)

      this.advancedSearch.originallyPublishedStartDate = start.toISOString()
    } else {
      this.advancedSearch.originallyPublishedStartDate = null
    }

    if (this.originallyPublishedEndYear) {
      const year = parseInt(this.originallyPublishedEndYear, 10)
      const end = new Date(baseDate)
      end.setFullYear(year)

      this.advancedSearch.originallyPublishedEndDate = end.toISOString()
    } else {
      this.advancedSearch.originallyPublishedEndDate = null
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
