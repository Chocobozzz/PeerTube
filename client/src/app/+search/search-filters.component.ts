import { Component, OnInit, inject, input, output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ServerService } from '@app/core'
import { AdvancedSearch } from '@app/shared/shared-search/advanced-search.model'
import { HTMLServerConfig, VideoConstant } from '@peertube/peertube-models'
import { SelectTagsComponent } from '../shared/shared-forms/select/select-tags.component'

type FormOption = { id: string, label: string }

@Component({
  selector: 'my-search-filters',
  styleUrls: [ './search-filters.component.scss' ],
  templateUrl: './search-filters.component.html',
  imports: [ FormsModule, SelectTagsComponent ]
})
export class SearchFiltersComponent implements OnInit {
  private serverService = inject(ServerService)

  advancedSearch = input<AdvancedSearch>(new AdvancedSearch())
  filtered = output<AdvancedSearch>()

  videoCategories: VideoConstant<number>[] = []
  videoLicences: VideoConstant<number>[] = []
  videoLanguages: VideoConstant<string>[] = []

  publishedDateRanges: FormOption[] = []
  sorts: FormOption[] = []
  durationRanges: FormOption[] = []

  publishedDateRange: string
  durationRange: string

  originallyPublishedStartYear: string
  originallyPublishedEndYear: string

  private serverConfig: HTMLServerConfig

  constructor () {
    this.publishedDateRanges = [
      {
        id: 'today',
        label: $localize`Today`
      },
      {
        id: 'last_7days',
        label: $localize`Last 7 days`
      },
      {
        id: 'last_30days',
        label: $localize`Last 30 days`
      },
      {
        id: 'last_365days',
        label: $localize`Last 365 days`
      }
    ]

    this.durationRanges = [
      {
        id: 'short',
        label: $localize`Short (< 4 min)`
      },
      {
        id: 'medium',
        label: $localize`Medium (4-10 min)`
      },
      {
        id: 'long',
        label: $localize`Long (> 10 min)`
      }
    ]

    this.sorts = [
      {
        id: '-match',
        label: $localize`Relevance`
      },
      {
        id: '-publishedAt',
        label: $localize`Publish date`
      },
      {
        id: '-views',
        label: $localize`Views`
      }
    ]
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.serverService.getVideoCategories().subscribe(categories => this.videoCategories = categories)
    this.serverService.getVideoLicences().subscribe(licences => this.videoLicences = licences)
    this.serverService.getVideoLanguages().subscribe(languages => this.videoLanguages = languages)

    this.loadFromDurationRange()
    this.loadFromPublishedRange()
    this.loadOriginallyPublishedAtYears()
  }

  onDurationOrPublishedUpdated () {
    this.updateModelFromDurationRange()
    this.updateModelFromPublishedRange()
    this.updateModelFromOriginallyPublishedAtYears()
  }

  formUpdated () {
    this.onDurationOrPublishedUpdated()
    this.filtered.emit(this.advancedSearch())
  }

  reset () {
    this.advancedSearch().reset()

    this.resetOriginalPublicationYears()

    this.durationRange = undefined
    this.publishedDateRange = undefined

    this.onDurationOrPublishedUpdated()
  }

  resetField (fieldName: keyof AdvancedSearch, value?: any) {
    ;(this.advancedSearch() as any)[fieldName] = value
  }

  resetLocalField (fieldName: keyof SearchFiltersComponent, value?: any) {
    this[fieldName] = value
    this.onDurationOrPublishedUpdated()
  }

  resetOriginalPublicationYears () {
    this.originallyPublishedStartYear = undefined
    this.originallyPublishedEndYear = undefined
  }

  isSearchTargetEnabled () {
    return this.serverConfig.search.searchIndex.enabled && this.serverConfig.search.searchIndex.disableLocalSearch !== true
  }

  private loadOriginallyPublishedAtYears () {
    const advancedSearch = this.advancedSearch()
    this.originallyPublishedStartYear = advancedSearch.originallyPublishedStartDate
      ? new Date(advancedSearch.originallyPublishedStartDate).getFullYear().toString()
      : undefined

    const advancedSearchValue = this.advancedSearch()
    this.originallyPublishedEndYear = advancedSearchValue.originallyPublishedEndDate
      ? new Date(advancedSearchValue.originallyPublishedEndDate).getFullYear().toString()
      : undefined
  }

  private loadFromDurationRange () {
    const advancedSearch = this.advancedSearch()
    if (advancedSearch.durationMin || advancedSearch.durationMax) {
      const fourMinutes = 60 * 4
      const tenMinutes = 60 * 10

      if (advancedSearch.durationMin === fourMinutes && advancedSearch.durationMax === tenMinutes) {
        this.durationRange = 'medium'
      } else if (advancedSearch.durationMax === fourMinutes) {
        this.durationRange = 'short'
      } else if (advancedSearch.durationMin === tenMinutes) {
        this.durationRange = 'long'
      }
    }
  }

  private loadFromPublishedRange () {
    const advancedSearch = this.advancedSearch()
    if (advancedSearch.startDate) {
      const date = new Date(advancedSearch.startDate)
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

    const advancedSearch = this.advancedSearch()
    if (this.originallyPublishedStartYear) {
      const year = parseInt(this.originallyPublishedStartYear, 10)
      const start = new Date(baseDate)
      start.setFullYear(year)

      advancedSearch.originallyPublishedStartDate = start.toISOString()
    } else {
      advancedSearch.originallyPublishedStartDate = undefined
    }

    if (this.originallyPublishedEndYear) {
      const year = parseInt(this.originallyPublishedEndYear, 10)
      const end = new Date(baseDate)
      end.setFullYear(year)

      advancedSearch.originallyPublishedEndDate = end.toISOString()
    } else {
      advancedSearch.originallyPublishedEndDate = undefined
    }
  }

  private updateModelFromDurationRange () {
    if (!this.durationRange) {
      const advancedSearch = this.advancedSearch()
      advancedSearch.durationMin = undefined
      advancedSearch.durationMax = undefined
      return
    }

    const fourMinutes = 60 * 4
    const tenMinutes = 60 * 10

    const advancedSearch = this.advancedSearch()
    const advancedSearchValue = this.advancedSearch()
    const advancedSearchVal = this.advancedSearch()
    switch (this.durationRange) {
      case 'short':
        advancedSearch.durationMin = undefined
        advancedSearch.durationMax = fourMinutes
        break

      case 'medium':
        advancedSearchValue.durationMin = fourMinutes
        advancedSearchValue.durationMax = tenMinutes
        break

      case 'long':
        advancedSearchVal.durationMin = tenMinutes
        advancedSearchVal.durationMax = undefined
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

    this.advancedSearch().startDate = date.toISOString()
  }
}
