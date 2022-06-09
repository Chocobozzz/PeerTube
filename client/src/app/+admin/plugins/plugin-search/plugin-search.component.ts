import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, ConfirmService, hasMoreItems, Notifier, PluginService } from '@app/core'
import { PeerTubePluginIndex, PluginType } from '@shared/models'

@Component({
  selector: 'my-plugin-search',
  templateUrl: './plugin-search.component.html',
  styleUrls: [
    '../shared/toggle-plugin-type.scss',
    '../shared/plugin-list.component.scss',
    './plugin-search.component.scss'
  ]
})
export class PluginSearchComponent implements OnInit {
  pluginTypeOptions: { label: string, value: PluginType }[] = []
  pluginType: PluginType = PluginType.PLUGIN

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  sort = '-popularity'

  search = ''
  isSearching = false

  plugins: PeerTubePluginIndex[] = []
  installing: { [name: string]: boolean } = {}
  pluginInstalled = false

  onDataSubject = new Subject<any[]>()

  private searchSubject = new Subject<string>()

  constructor (
    private pluginService: PluginService,
    private pluginApiService: PluginApiService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.pluginTypeOptions = this.pluginApiService.getPluginTypeOptions()
  }

  ngOnInit () {
    const query = this.route.snapshot.queryParams
    if (query['pluginType']) this.pluginType = parseInt(query['pluginType'], 10)

    this.searchSubject.asObservable()
        .pipe(
          debounceTime(400),
          distinctUntilChanged()
        )
        .subscribe(search => {
          this.search = search
          this.reloadPlugins()
        })

    this.reloadPlugins()
  }

  onSearchChange (event: Event) {
    const target = event.target as HTMLInputElement

    this.searchSubject.next(target.value)
  }

  reloadPlugins () {
    this.pagination.currentPage = 1
    this.plugins = []

    this.router.navigate([], { queryParams: { pluginType: this.pluginType } })

    this.loadMorePlugins()
  }

  loadMorePlugins () {
    this.isSearching = true

    this.pluginApiService.searchAvailablePlugins(this.pluginType, this.pagination, this.sort, this.search)
        .subscribe(
          res => {
            this.isSearching = false

            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          err => {
            console.error(err)

            const message = $localize`The plugin index is not available. Please retry later.`
            this.notifier.error(message)
          }
        )
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1

    this.loadMorePlugins()
  }

  isInstalling (plugin: PeerTubePluginIndex) {
    return !!this.installing[plugin.npmName]
  }

  getPluginOrThemeHref (name: string) {
    return this.pluginApiService.getPluginOrThemeHref(this.pluginType, name)
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
        .subscribe(
          () => {
            this.installing[plugin.npmName] = false
            this.pluginInstalled = true

            this.notifier.success($localize`${plugin.name} installed.`)

            plugin.installed = true
          },

          err => this.notifier.error(err.message)
        )
  }
}
