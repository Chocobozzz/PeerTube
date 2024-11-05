import { NgClass, NgIf } from '@angular/common'
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { AuthService, RedirectService } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap'
import { UserRight, VideoConstant } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import debug from 'debug'
import { SelectOptionsItem } from 'src/types'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { SelectCategoriesComponent } from '../shared-forms/select/select-categories.component'
import { SelectLanguagesComponent } from '../shared-forms/select/select-languages.component'
import { SelectOptionsComponent } from '../shared-forms/select/select-options.component'
import { GlobalIconComponent, GlobalIconName } from '../shared-icons/global-icon.component'
import { InstanceFollowService } from '../shared-instance/instance-follow.service'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { PeertubeModalService } from '../shared-main/peertube-modal/peertube-modal.service'
import { VideoFilterActive, VideoFilters } from './video-filters.model'

const debugLogger = debug('peertube:videos:VideoFiltersHeaderComponent')

type QuickFilter = {
  iconName: GlobalIconName
  label: string
  isActive: () => boolean
  filters: Partial<AttributesOnly<VideoFilters>>
}

@Component({
  selector: 'my-video-filters-header',
  styleUrls: [ './video-filters-header.component.scss' ],
  templateUrl: './video-filters-header.component.html',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    NgClass,
    NgIf,
    GlobalIconComponent,
    NgbCollapse,
    SelectLanguagesComponent,
    SelectCategoriesComponent,
    PeertubeCheckboxComponent,
    SelectOptionsComponent,
    ButtonComponent
  ],
  providers: [ InstanceFollowService ]
})
export class VideoFiltersHeaderComponent implements OnInit {
  @Input() filters: VideoFilters
  @Input() displayModerationBlock = false
  @Input() hideScope = false

  @Output() filtersChanged = new EventEmitter()

  areFiltersCollapsed = true

  form: FormGroup

  sortItems: SelectOptionsItem[] = []
  availableScopes: SelectOptionsItem[] = []

  quickFilters: QuickFilter[] = []

  instanceName: string
  totalFollowing: number

  private videoCategories: VideoConstant<number>[] = []
  private videoLanguages: VideoConstant<string>[] = []

  constructor (
    private auth: AuthService,
    private serverService: ServerService,
    private fb: FormBuilder,
    private modalService: PeertubeModalService,
    private redirectService: RedirectService,
    private server: ServerService,
    private followService: InstanceFollowService
  ) {
  }

  ngOnInit () {
    this.instanceName = this.server.getHTMLConfig().instance.name

    this.form = this.fb.group({
      sort: [ '' ],
      nsfw: [ '' ],
      languageOneOf: [ '' ],
      categoryOneOf: [ '' ],
      scope: [ '' ],
      allVideos: [ '' ],
      live: [ '' ]
    })

    this.patchForm(false)

    this.filters.onChange(() => {
      this.patchForm(false)
    })

    this.form.valueChanges.subscribe(values => {
      debugLogger('Loading values from form: %O', values)

      this.filters.load(values)
      this.filtersChanged.emit()
    })

    this.serverService.getVideoCategories()
      .subscribe(categories => this.videoCategories = categories)

    this.serverService.getVideoLanguages()
      .subscribe(languages => this.videoLanguages = languages)

    this.followService.getFollowing({ pagination: { count: 1, start: 0 }, state: 'accepted' })
      .subscribe(({ total }) => this.totalFollowing = total)

    this.availableScopes = [
      { id: 'local', label: $localize`Only videos from this platform` },
      { id: 'federated', label: $localize`Videos from all platforms` }
    ]

    this.buildSortItems()
    this.buildQuickFilters()
  }

  canSeeAllVideos () {
    if (!this.auth.isLoggedIn()) return false
    if (!this.displayModerationBlock) return false

    return this.auth.getUser().hasRight(UserRight.SEE_ALL_VIDEOS)
  }

  // ---------------------------------------------------------------------------

  onQuickFilter (e: Event, quickFilter: QuickFilter) {
    e.preventDefault()

    this.filters.load(quickFilter.filters)
    this.filtersChanged.emit()
  }

  private buildQuickFilters () {
    const trendingSort = this.redirectService.getDefaultTrendingSort()

    this.quickFilters = [
      {
        label: $localize`Recently added`,
        iconName: 'add',
        isActive: () => this.filters.sort === '-publishedAt',
        filters: { sort: '-publishedAt' }
      },

      {
        label: $localize`Trending`,
        iconName: 'trending',
        isActive: () => this.filters.sort === trendingSort,
        filters: { sort: trendingSort }
      }
    ]
  }

  // ---------------------------------------------------------------------------

  private buildSortItems () {
    this.sortItems = [
      { id: '-publishedAt', label: $localize`Recently Added` },
      { id: '-originallyPublishedAt', label: $localize`Original Publication Date` },
      { id: 'name', label: $localize`Name` }
    ]

    if (this.isTrendingSortEnabled('most-viewed')) {
      this.sortItems.push({ id: '-trending', label: $localize`Recent Views` })
    }

    if (this.isTrendingSortEnabled('hot')) {
      this.sortItems.push({ id: '-hot', label: $localize`Hot` })
    }

    if (this.isTrendingSortEnabled('most-liked')) {
      this.sortItems.push({ id: '-likes', label: $localize`Likes` })
    }

    this.sortItems.push({ id: '-views', label: $localize`Global Views` })
  }

  private isTrendingSortEnabled (sort: 'most-viewed' | 'hot' | 'most-liked') {
    const serverConfig = this.serverService.getHTMLConfig()

    return serverConfig.trending.videos.algorithms.enabled.includes(sort)
  }

  getFilterValue (filter: VideoFilterActive) {
    if ((filter.key === 'categoryOneOf' || filter.key === 'languageOneOf') && Array.isArray(filter.rawValue)) {
      if (filter.rawValue.length > 2) {
        return filter.rawValue.length
      }

      const translated = filter.key === 'categoryOneOf'
        ? this.videoCategories
        : this.videoLanguages

      const formatted = filter.rawValue
        .map(v => {
          if (v === '_unknown') return $localize`Unknown`

          return translated.find(c => c.id + '' === v)?.label
        })
        .join(', ')

      return formatted
    }

    return filter.value
  }

  onAccountSettingsClick (event: Event) {
    if (this.auth.isLoggedIn()) return

    event.preventDefault()
    event.stopPropagation()

    this.modalService.openQuickSettingsSubject.next()
  }

  private patchForm (emitEvent: boolean) {
    const defaultValues = this.filters.toFormObject()
    this.form.patchValue(defaultValues, { emitEvent })

    debugLogger('Patched form: %O', defaultValues)
  }
}
