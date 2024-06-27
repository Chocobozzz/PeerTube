import { Subject, Subscription } from 'rxjs'
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, ConfirmService, hasMoreItems, Notifier, PeerTubeSocket, PluginService } from '@app/core'
import { PeerTubePluginIndex, PluginManagePayload, PluginType, PluginType_Type, UserNotificationType } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { EditButtonComponent } from '../../../shared/shared-main/buttons/edit-button.component'
import { PluginCardComponent } from '../shared/plugin-card.component'
import { InfiniteScrollerDirective } from '../../../shared/shared-main/angular/infinite-scroller.directive'
import { AutofocusDirective } from '../../../shared/shared-main/angular/autofocus.directive'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { NgIf, NgFor } from '@angular/common'
import { PluginNavigationComponent } from '../shared/plugin-navigation.component'
import { JobService } from '@app/+admin/system'

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
    InfiniteScrollerDirective,
    NgFor,
    PluginCardComponent,
    EditButtonComponent,
    ButtonComponent
  ]
})
export class PluginSearchComponent implements OnInit, OnDestroy {
  pluginType: PluginType_Type

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  sort = '-trending'

  search = ''
  isSearching = false

  plugins: PeerTubePluginIndex[] = []
  toBeInstalled: { [name: string]: boolean } = {}
  pluginInstalled = false

  onDataSubject = new Subject<any[]>()

  private searchSubject = new Subject<string>()
  private notificationSub: Subscription

  constructor (
    private pluginService: PluginService,
    private pluginApiService: PluginApiService,
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private router: Router,
    private route: ActivatedRoute,
    private jobService: JobService,
    private peertubeSocket: PeerTubeSocket
  ) {
  }

  ngOnInit () {
    if (!this.route.snapshot.queryParams['pluginType']) {
      const queryParams = { pluginType: PluginType.PLUGIN }

      this.router.navigate([], { queryParams })
    }

    this.jobService.listUnfinishedJobs({
      jobType: 'plugin-manage',
      pagination: {
        count: 10,
        start: 0
      },
      sort: {
        field: 'createdAt',
        order: -1
      }
    }).subscribe({
      next: resultList => {
        const jobs = resultList.data

        jobs.forEach((job) => {
          let payload: PluginManagePayload

          try {
            payload = JSON.parse(job.data)
          } catch (err) {}

          if (payload.action === 'install') {
            this.toBeInstalled[payload.npmName] = true
          }
        })
      },

      error: err => {
        logger.error('Could not fetch status of installed plugins.', { err })
        this.notifier.error($localize`Could not fetch status of installed plugins.`)
      }
    })

    this.route.queryParams.subscribe(query => {
      if (!query['pluginType']) return

      this.pluginType = parseInt(query['pluginType'], 10) as PluginType_Type
      this.search = query['search'] || ''

      this.reloadPlugins()
    })

    this.searchSubject.asObservable()
        .pipe(
          debounceTime(400),
          distinctUntilChanged()
        )
        .subscribe(search => this.router.navigate([], { queryParams: { search }, queryParamsHandling: 'merge' }))

    this.subscribeToNotifications()
  }

  ngOnDestroy () {
    if (this.notificationSub) this.notificationSub.unsubscribe()
  }

  onSearchChange (event: Event) {
    const target = event.target as HTMLInputElement

    this.searchSubject.next(target.value)
  }

  reloadPlugins () {
    this.pagination.currentPage = 1
    this.plugins = []

    this.loadMorePlugins()
  }

  loadMorePlugins () {
    this.isSearching = true

    this.pluginApiService.searchAvailablePlugins(this.pluginType, this.pagination, this.sort, this.search)
        .subscribe({
          next: res => {
            this.isSearching = false

            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          error: err => {
            logger.error(err)

            const message = $localize`The plugin index is not available. Please retry later.`
            this.notifier.error(message)
          }
        })
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1

    this.loadMorePlugins()
  }

  willInstall (plugin: PeerTubePluginIndex) {
    return !!this.toBeInstalled[plugin.npmName]
  }

  getShowRouterLink (plugin: PeerTubePluginIndex) {
    return [ '/admin', 'plugins', 'show', this.pluginService.nameToNpmName(plugin.name, this.pluginType) ]
  }

  isThemeSearch () {
    return this.pluginType === PluginType.THEME
  }

  async install (plugin: PeerTubePluginIndex) {
    if (this.toBeInstalled[plugin.npmName]) return

    const res = await this.confirmService.confirm(
      $localize`Please only install plugins or themes you trust, since they can execute any code on your instance.`,
      $localize`Install ${plugin.name}?`
    )
    if (res === false) return

    this.toBeInstalled[plugin.npmName] = true

    this.pluginApiService.install(plugin.npmName)
        .subscribe({
          next: () => {
            this.notifier.success($localize`${plugin.name} will be installed.`)
          },

          error: err => {
            this.toBeInstalled[plugin.npmName] = false

            this.notifier.error(err.message)
          }
        })
  }

  private async subscribeToNotifications () {
    const obs = await this.peertubeSocket.getMyNotificationsSocket()

    this.notificationSub = obs
      .pipe(
        filter(d => d.notification?.type === UserNotificationType.PLUGIN_MANAGE_FINISHED)
      ).subscribe(data => {
        const pluginName = data.notification.plugin?.name

        if (pluginName) {
          const npmName = this.pluginService.nameToNpmName(data.notification.plugin.name, data.notification.plugin.type)

          if (this.toBeInstalled[npmName]) {
            this.toBeInstalled[npmName] = false

            if (!data.notification.hasOperationFailed) {
              const plugin = this.plugins.find(p => p.name === pluginName)

              if (plugin) {
                plugin.installed = true
              }
            }
          }
        }
      })
  }
}
