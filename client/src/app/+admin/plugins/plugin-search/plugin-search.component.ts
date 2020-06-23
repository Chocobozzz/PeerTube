import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, ConfirmService, hasMoreItems, Notifier, ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { PeerTubePluginIndex } from '@shared/models/plugins/peertube-plugin-index.model'
import { PluginType } from '@shared/models/plugins/plugin.type'

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
    private server: ServerService,
    private i18n: I18n,
    private pluginService: PluginApiService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.pluginTypeOptions = this.pluginService.getPluginTypeOptions()
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

    this.pluginService.searchAvailablePlugins(this.pluginType, this.pagination, this.sort, this.search)
        .subscribe(
          res => {
            this.isSearching = false

            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          err => {
            console.error(err)

            const message = this.i18n('The plugin index is not available. Please retry later.')
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

  async install (plugin: PeerTubePluginIndex) {
    if (this.installing[plugin.npmName]) return

    const res = await this.confirmService.confirm(
      this.i18n('Please only install plugins or themes you trust, since they can execute any code on your instance.'),
      this.i18n('Install {{pluginName}}?', { pluginName: plugin.name })
    )
    if (res === false) return

    this.installing[plugin.npmName] = true

    this.pluginService.install(plugin.npmName)
        .subscribe(
          () => {
            this.installing[plugin.npmName] = false
            this.pluginInstalled = true

            this.notifier.success(this.i18n('{{pluginName}} installed.', { pluginName: plugin.name }))

            plugin.installed = true
          },

          err => this.notifier.error(err.message)
        )
  }
}
