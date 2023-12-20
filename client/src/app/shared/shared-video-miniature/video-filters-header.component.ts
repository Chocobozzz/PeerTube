import * as debug from 'debug'
import { Subscription } from 'rxjs'
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { AuthService } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import { UserRight } from '@peertube/peertube-models'
import { PeertubeModalService } from '../shared-main'
import { VideoFilters } from './video-filters.model'

const debugLogger = debug('peertube:videos:VideoFiltersHeaderComponent')

@Component({
  selector: 'my-video-filters-header',
  styleUrls: [ './video-filters-header.component.scss' ],
  templateUrl: './video-filters-header.component.html'
})
export class VideoFiltersHeaderComponent implements OnInit, OnDestroy {
  @Input() filters: VideoFilters
  @Input() displayModerationBlock = false
  @Input() hideScope = false

  @Output() filtersChanged = new EventEmitter()

  areFiltersCollapsed = true

  form: FormGroup

  private routeSub: Subscription

  constructor (
    private auth: AuthService,
    private serverService: ServerService,
    private fb: FormBuilder,
    private modalService: PeertubeModalService,
    private server: ServerService
  ) {
  }

  ngOnInit () {
    this.form = this.fb.group({
      sort: [ '' ],
      nsfw: [ '' ],
      languageOneOf: [ '' ],
      categoryOneOf: [ '' ],
      scopeToggle: [ '' ],
      scope: [ '' ],
      allVideos: [ '' ],
      live: [ '' ]
    })

    this.patchForm(false)

    this.filters.onChange(() => {
      this.patchForm(false)
    })

    this.form.controls.scopeToggle.valueChanges.subscribe(value => {
      this.form.controls.scope.setValue(value ? 'federated' : 'local', { emitEvent: false })
    })
    this.form.controls.scope.valueChanges.subscribe(value => {
      this.form.controls.scopeToggle.setValue(value === 'federated', { emitEvent: false })
    })

    this.form.valueChanges.subscribe(values => {
      debugLogger('Loading values from form: %O', values)

      this.filters.load(values)
      this.filtersChanged.emit()
    })

    this.server.getVideoLanguages()
      .subscribe(
        languages => {
          this.filters.availableLanguages = languages.map(l => {
            if (l.id === 'zxx') return { label: l.label, id: l.id }
            return { label: l.label, id: l.id }
          })
          this.filters.buildActiveFilters()
        }
      )
    this.server.getVideoCategories()
      .subscribe(
        categories => {
          this.filters.availableCategories = categories.map(c => ({ label: c.label, id: c.id + '' }))
          this.filters.buildActiveFilters()
        }
      )
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  canSeeAllVideos () {
    if (!this.auth.isLoggedIn()) return false
    if (!this.displayModerationBlock) return false

    return this.auth.getUser().hasRight(UserRight.SEE_ALL_VIDEOS)
  }

  isTrendingSortEnabled (sort: 'most-viewed' | 'hot' | 'most-liked') {
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

  getSortOptions () {
    const options: { label: string, value: string, group: string, description?: string }[] = [
      {
        label: $localize`Recently Added`,
        value: "-publishedAt",
        group: $localize`date`,
        description: $localize`Uses the effective publication date`
      },
      {
        label: $localize`Original Publication`,
        value: "-orginallyPublishedAt",
        group: $localize`date`,
        description: $localize`Uses the original publication date`
      },
      {
        label: $localize`Name`,
        value: "name",
        group: $localize`text`,
        description: $localize`Alphabetical order`
      },
    ]

    if (this.isTrendingSortEnabled('hot')) options.push({
      label: $localize`Hot`,
      value: "-hot",
      group: $localize`interactions`,
      description: $localize`Most recent interactions`
    })
    if (this.isTrendingSortEnabled('most-liked')) options.push({
      label: $localize`Likes`,
      value: "-likes",
      group: $localize`interactions`,
      description: $localize`Most recent likes`
    })
    if (this.isTrendingSortEnabled('most-viewed')) options.push({
      label: $localize`Recent Views`,
      value: "-trending",
      group: $localize`interactions`,
      description: $localize`Most recent views over 7 days`
    })

    options.push({
      label: $localize`Global Views`,
      value: "-views",
      group: $localize`interactions`,
      description: $localize`Most absolute views`
    })
  
    return options
  }

  onAccountSettingsClick (event: Event) {
    if (this.auth.isLoggedIn()) return

    event.preventDefault()
    event.stopPropagation()

    this.modalService.openQuickSettingsSubject.next()
  }

  private patchForm (emitEvent: boolean) {
    let defaultValues = {
      ...this.filters.toFormObject(),
      scopeToggle: this.filters.scope === 'federated' ? true : false
    }
    this.form.patchValue(defaultValues, { emitEvent })

    debugLogger('Patched form: %O', defaultValues)
  }
}
