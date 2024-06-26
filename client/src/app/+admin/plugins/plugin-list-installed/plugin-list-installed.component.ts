import { Subject, Subscription, filter } from 'rxjs'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, ConfirmService, hasMoreItems, Notifier, PeerTubeSocket } from '@app/core'
import { PluginService } from '@app/core/plugins/plugin.service'
import { compareSemVer } from '@peertube/peertube-core-utils'
import { PeerTubePlugin, PluginManagePayload, PluginType, PluginType_Type, UserNotificationType } from '@peertube/peertube-models'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { EditButtonComponent } from '../../../shared/shared-main/buttons/edit-button.component'
import { PluginCardComponent } from '../shared/plugin-card.component'
import { InfiniteScrollerDirective } from '../../../shared/shared-main/angular/infinite-scroller.directive'
import { NgIf, NgFor } from '@angular/common'
import { PluginNavigationComponent } from '../shared/plugin-navigation.component'
import { JobService } from '@app/+admin/system'
import { logger } from '@root-helpers/logger'

@Component({
  selector: 'my-plugin-list-installed',
  templateUrl: './plugin-list-installed.component.html',
  styleUrls: [ './plugin-list-installed.component.scss' ],
  standalone: true,
  imports: [
    PluginNavigationComponent,
    NgIf,
    InfiniteScrollerDirective,
    NgFor,
    PluginCardComponent,
    EditButtonComponent,
    ButtonComponent,
    DeleteButtonComponent
  ]
})
export class PluginListInstalledComponent implements OnInit, OnDestroy {
  pluginType: PluginType_Type

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  sort = 'name'

  plugins: PeerTubePlugin[] = []
  toBeUpdated: { [name: string]: boolean } = {}
  toBeUninstalled: { [name: string]: boolean } = {}

  onDataSubject = new Subject<any[]>()

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

      this.router.navigate([], { queryParams, replaceUrl: true })
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

          if (payload.action === 'update') {
            this.toBeUpdated[payload.npmName] = true
          }

          if (payload.action === 'uninstall') {
            this.toBeUninstalled[payload.npmName] = true
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

      this.reloadPlugins()
    })

    this.subscribeToNotifications()
  }

  ngOnDestroy () {
    if (this.notificationSub) this.notificationSub.unsubscribe()
  }

  reloadPlugins () {
    this.pagination.currentPage = 1
    this.plugins = []

    this.loadMorePlugins()
  }

  loadMorePlugins () {
    this.pluginApiService.getPlugins(this.pluginType, this.pagination, this.sort)
        .subscribe({
          next: res => {
            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          error: err => this.notifier.error(err.message)
        })
  }

  onNearOfBottom () {
    if (!hasMoreItems(this.pagination)) return

    this.pagination.currentPage += 1

    this.loadMorePlugins()
  }

  getNoResultMessage () {
    if (this.pluginType === PluginType.PLUGIN) {
      return $localize`You don't have plugins installed yet.`
    }

    return $localize`You don't have themes installed yet.`
  }

  isUpdateAvailable (plugin: PeerTubePlugin) {
    return plugin.latestVersion && compareSemVer(plugin.latestVersion, plugin.version) > 0
  }

  getUpdateLabel (plugin: PeerTubePlugin) {
    return $localize`Update to ${plugin.latestVersion}`
  }

  willUpdate (plugin: PeerTubePlugin) {
    return !!this.toBeUpdated[this.getPluginKey(plugin)]
  }

  willUninstall (plugin: PeerTubePlugin) {
    return !!this.toBeUninstalled[this.getPluginKey(plugin)]
  }

  isTheme (plugin: PeerTubePlugin) {
    return plugin.type === PluginType.THEME
  }

  async uninstall (plugin: PeerTubePlugin) {
    const pluginKey = this.getPluginKey(plugin)
    if (this.toBeUninstalled[pluginKey]) return

    const res = await this.confirmService.confirm(
      $localize`Do you really want to uninstall ${plugin.name}?`,
      $localize`Uninstall`
    )
    if (res === false) return

    this.toBeUninstalled[pluginKey] = true

    this.pluginApiService.uninstall(plugin.name, plugin.type)
      .subscribe({
        next: () => {
          this.notifier.success($localize`${plugin.name} will be uninstalled.`)
        },

        error: err => {
          this.notifier.error(err.message)
          this.toBeUninstalled[pluginKey] = false
        }
      })
  }

  async update (plugin: PeerTubePlugin) {
    const pluginKey = this.getPluginKey(plugin)
    if (this.toBeUpdated[pluginKey]) return

    if (this.isMajorUpgrade(plugin)) {
      const res = await this.confirmService.confirm(
        $localize`This is a major plugin upgrade. Please go on the plugin homepage to check potential release notes.`,
        $localize`Upgrade`,
        $localize`Proceed upgrade`
      )

      if (res === false) return
    }

    this.toBeUpdated[pluginKey] = true

    this.pluginApiService.update(plugin.name, plugin.type)
        .pipe()
        .subscribe({
          next: res => {
            this.notifier.success($localize`${plugin.name} will be updated.`)
          },

          error: err => {
            this.notifier.error(err.message)
            this.toBeUpdated[pluginKey] = false
          }
        })
  }

  getShowRouterLink (plugin: PeerTubePlugin) {
    return [ '/admin', 'plugins', 'show', this.pluginService.nameToNpmName(plugin.name, plugin.type) ]
  }

  getPluginOrThemeHref (name: string) {
    return this.pluginApiService.getPluginOrThemeHref(this.pluginType, name)
  }

  private async subscribeToNotifications () {
    const obs = await this.peertubeSocket.getMyNotificationsSocket()

    this.notificationSub = obs
      .pipe(
        filter(d => d.notification?.type === UserNotificationType.PLUGIN_MANAGE_FINISHED)
      ).subscribe(data => {
        const pluginName = data.notification.plugin?.name

        if (pluginName) {
          const npmName = this.getPluginKey(data.notification.plugin)

          if (this.toBeUninstalled[npmName]) {
            this.toBeUninstalled[npmName] = false

            if (!data.notification.hasOperationFailed) {
              this.plugins = this.plugins.filter(p => p.name !== pluginName)
            }
          }

          if (this.toBeUpdated[npmName]) {
            this.toBeUpdated[npmName] = false
            this.reloadPlugins()
          }
        }
      })
  }

  private getPluginKey (plugin: Pick<PeerTubePlugin, 'name' | 'type'>) {
    return this.pluginService.nameToNpmName(plugin.name, plugin.type)
  }

  private isMajorUpgrade (plugin: PeerTubePlugin) {
    if (!plugin.latestVersion) return false

    const latestMajor = parseInt(plugin.latestVersion.split('.')[0])
    const currentMajor = parseInt(plugin.version.split('.')[0])

    return latestMajor > currentMajor
  }
}
