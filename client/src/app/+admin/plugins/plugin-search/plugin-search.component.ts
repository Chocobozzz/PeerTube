import { NgFor, NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, ConfirmService, hasMoreItems, Notifier, PluginService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { PeerTubePluginIndex, PluginType, PluginType_Type } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { ReplaySubject, Subject } from 'rxjs'
import { debounceTime, distinct, distinctUntilChanged, filter } from 'rxjs/operators'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { EditButtonComponent } from '../../../shared/shared-main/buttons/edit-button.component'
import { AutofocusDirective } from '../../../shared/shared-main/common/autofocus.directive'
import { PluginCardComponent } from '../shared/plugin-card.component'
import { InfiniteScrollerComponent } from '../../../shared/shared-main/common/infinite-scroller.component'
import { PluginNavigationComponent } from '../shared/plugin-navigation.component'

@Component({
  selector: 'my-plugin-search',
  templateUrl: './plugin-search.component.html',
  styleUrls: [ './plugin-search.component.scss' ],
  standalone: true,
  imports: [
    PluginNavigationComponent,
    NgIf,
    GlobalIconComponent,
    AutofocusDirective,
    InfiniteScrollerComponent,
    NgFor,
    PluginCardComponent,
    EditButtonComponent,
    ButtonComponent,
    AlertComponent
  ]
})
export class PluginSearchComponent implements OnInit {
  pluginType: PluginType_Type

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  sort = '-trending'
  hasMoreResults = true

  search = ''
  isSearching = true

  plugins: PeerTubePluginIndex[] = []
  installing: { [name: string]: boolean } = {}
  pluginInstalled = false

  private searchSubject = new Subject<string>()
  private hasInitialized = new ReplaySubject<boolean>()

  constructor (
    private pluginService: PluginService,
    private pluginApiService: PluginApiService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private router: Router,
    private route: ActivatedRoute
  ) {
  }

  ngOnInit () {
    if (!this.route.snapshot.queryParams['pluginType']) {
      const queryParams = { pluginType: PluginType.PLUGIN }

      this.router.navigate([], { queryParams })
    }

    this.route.queryParams.subscribe(query => {
      if (!query['pluginType']) return

      const oldSearch = this.search
      this.pluginType = parseInt(query['pluginType'], 10) as PluginType_Type
      this.search = query['search'] || ''
      this.hasInitialized.next(true)

      if (oldSearch !== this.search) {
        this.pagination.currentPage = 1
        this.onPageChange()
      }
    })

    this.searchSubject.asObservable()
        .pipe(
          debounceTime(400),
          distinctUntilChanged()
        )
        .subscribe(search => this.router.navigate([], { queryParams: { search }, queryParamsHandling: 'merge' }))
  }

  onSearchChange (event: Event) {
    const target = event.target as HTMLInputElement

    this.searchSubject.next(target.value)
  }

  loadMorePlugins (reset = false) {
    this.isSearching = true

    this.pluginApiService.searchAvailablePlugins(this.pluginType, this.pagination, this.sort, this.search)
        .subscribe({
          next: res => {
            this.isSearching = false

            if (reset) this.plugins = []

            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total
            this.hasMoreResults = (this.pagination.itemsPerPage * this.pagination.currentPage) < this.pagination.totalItems
          },

          error: err => {
            logger.error(err)

            const message = $localize`The plugin index is not available. Please retry later.`
            this.notifier.error(message)
          }
        })
  }

  onPageChange () {
    this.hasInitialized.pipe(
      distinct(),
      filter(val => val)
    )
    .subscribe(() => this.loadMorePlugins(true))
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1

    this.loadMorePlugins()
  }

  isInstalling (plugin: PeerTubePluginIndex) {
    return !!this.installing[plugin.npmName]
  }

  getShowRouterLink (plugin: PeerTubePluginIndex) {
    return [ '/admin', 'plugins', 'show', this.pluginService.nameToNpmName(plugin.name, this.pluginType) ]
  }

  isThemeSearch () {
    return this.pluginType === PluginType.THEME
  }

  async install (plugin: PeerTubePluginIndex) {
    if (this.installing[plugin.npmName]) return

    const res = await this.confirmService.confirm(
      $localize`Please only install plugins or themes you trust, since they can execute any code on your instance.`,
      $localize`Install ${plugin.name}?`
    )
    if (res === false) return

    this.installing[plugin.npmName] = true

    this.pluginApiService.install(plugin.npmName)
        .subscribe({
          next: () => {
            this.installing[plugin.npmName] = false
            this.pluginInstalled = true

            this.notifier.success($localize`${plugin.name} installed.`)

            plugin.installed = true
          },

          error: err => {
            this.installing[plugin.npmName] = false

            this.notifier.error(err.message)
          }
        })
  }
}
