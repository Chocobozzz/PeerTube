import { NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { AuthService } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap'
import { UserRight, VideoConstant } from '@peertube/peertube-models'
import debug from 'debug'
import { Subscription } from 'rxjs'
import { SelectOptionsItem } from 'src/types'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { SelectCategoriesComponent } from '../shared-forms/select/select-categories.component'
import { SelectLanguagesComponent } from '../shared-forms/select/select-languages.component'
import { SelectOptionsComponent } from '../shared-forms/select/select-options.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { PeerTubeTemplateDirective } from '../shared-main/common/peertube-template.directive'
import { PeertubeModalService } from '../shared-main/peertube-modal/peertube-modal.service'
import { VideoFilterActive, VideoFilters } from './video-filters.model'

const debugLogger = debug('peertube:videos:VideoFiltersHeaderComponent')

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
    NgFor,
    NgbCollapse,
    NgTemplateOutlet,
    SelectLanguagesComponent,
    SelectCategoriesComponent,
    PeertubeCheckboxComponent,
    SelectOptionsComponent,
    PeerTubeTemplateDirective
  ]
})
export class VideoFiltersHeaderComponent implements OnInit, OnDestroy {
  @Input() filters: VideoFilters
  @Input() displayModerationBlock = false
  @Input() hideScope = false

  @Output() filtersChanged = new EventEmitter()

  areFiltersCollapsed = true

  form: FormGroup

  sortItems: SelectOptionsItem[] = []

  private videoCategories: VideoConstant<number>[] = []
  private videoLanguages: VideoConstant<string>[] = []

  private routeSub: Subscription

  constructor (
    private auth: AuthService,
    private serverService: ServerService,
    private fb: FormBuilder,
    private modalService: PeertubeModalService
  ) {
  }

  ngOnInit () {
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

    this.buildSortItems()
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  canSeeAllVideos () {
    if (!this.auth.isLoggedIn()) return false
    if (!this.displayModerationBlock) return false

    return this.auth.getUser().hasRight(UserRight.SEE_ALL_VIDEOS)
  }

  private buildSortItems () {
    this.sortItems = [
      { id: '-publishedAt', label: 'Recently Added' },
      { id: '-originallyPublishedAt', label: 'Original Publication Date' },
      { id: 'name', label: 'Name' }
    ]

    if (this.isTrendingSortEnabled('most-viewed')) {
      this.sortItems.push({ id: '-trending', label: 'Recent Views' })
    }

    if (this.isTrendingSortEnabled('hot')) {
      this.sortItems.push({ id: '-hot', label: 'Hot' })
    }

    if (this.isTrendingSortEnabled('most-liked')) {
      this.sortItems.push({ id: '-likes', label: 'Likes' })
    }

    this.sortItems.push({ id: '-views', label: 'Global Views' })
  }

  private isTrendingSortEnabled (sort: 'most-viewed' | 'hot' | 'most-liked') {
    const serverConfig = this.serverService.getHTMLConfig()

    return serverConfig.trending.videos.algorithms.enabled.includes(sort)
  }

  resetFilter (key: string, canRemove: boolean) {
    if (!canRemove) return

    this.filters.reset(key)
    this.patchForm(false)
    this.filtersChanged.emit()
  }

  getFilterTitle (canRemove: boolean) {
    if (canRemove) return $localize`Remove this filter`

    return ''
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
