import { Subject } from 'rxjs'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, ConfirmService, hasMoreItems, Notifier } from '@app/core'
import { PluginService } from '@app/core/plugins/plugin.service'
import { compareSemVer } from '@shared/core-utils/miscs/miscs'
import { PeerTubePlugin, PluginType } from '@shared/models'

@Component({
  selector: 'my-plugin-list-installed',
  templateUrl: './plugin-list-installed.component.html',
  styleUrls: [
    '../shared/toggle-plugin-type.scss',
    '../shared/plugin-list.component.scss',
    './plugin-list-installed.component.scss'
  ]
})
export class PluginListInstalledComponent implements OnInit {
  pluginTypeOptions: { label: string, value: PluginType }[] = []
  pluginType: PluginType = PluginType.PLUGIN

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  sort = 'name'

  plugins: PeerTubePlugin[] = []
  updating: { [name: string]: boolean } = {}

  onDataSubject = new Subject<any[]>()

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

    this.reloadPlugins()
  }

  reloadPlugins () {
    this.pagination.currentPage = 1
    this.plugins = []

    this.router.navigate([], { queryParams: { pluginType: this.pluginType } })

    this.loadMorePlugins()
  }

  loadMorePlugins () {
    this.pluginApiService.getPlugins(this.pluginType, this.pagination, this.sort)
        .subscribe(
          res => {
            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total

            this.onDataSubject.next(res.data)
          },

          err => this.notifier.error(err.message)
        )
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

  isUpdating (plugin: PeerTubePlugin) {
    return !!this.updating[this.getUpdatingKey(plugin)]
  }

  isTheme (plugin: PeerTubePlugin) {
    return plugin.type === PluginType.THEME
  }

  async uninstall (plugin: PeerTubePlugin) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to uninstall ${plugin.name}?`,
      $localize`Uninstall`
    )
    if (res === false) return

    this.pluginApiService.uninstall(plugin.name, plugin.type)
      .subscribe(
        () => {
          this.notifier.success($localize`${plugin.name} uninstalled.`)

          this.plugins = this.plugins.filter(p => p.name !== plugin.name)
          this.pagination.totalItems--
        },

        err => this.notifier.error(err.message)
      )
  }

  async update (plugin: PeerTubePlugin) {
    const updatingKey = this.getUpdatingKey(plugin)
    if (this.updating[updatingKey]) return

    if (this.isMajorUpgrade(plugin)) {
      const res = await this.confirmService.confirm(
        $localize`This is a major plugin upgrade. Please go on the plugin homepage to check potential release notes.`,
        $localize`Upgrade`,
        $localize`Proceed upgrade`
      )

      if (res === false) return
    }

    this.updating[updatingKey] = true

    this.pluginApiService.update(plugin.name, plugin.type)
        .pipe()
        .subscribe(
          res => {
            this.updating[updatingKey] = false

            this.notifier.success($localize`${plugin.name} updated.`)

            Object.assign(plugin, res)
          },

          err => this.notifier.error(err.message)
        )
  }

  getShowRouterLink (plugin: PeerTubePlugin) {
    return [ '/admin', 'plugins', 'show', this.pluginService.nameToNpmName(plugin.name, plugin.type) ]
  }

  getPluginOrThemeHref (name: string) {
    return this.pluginApiService.getPluginOrThemeHref(this.pluginType, name)
  }

  private getUpdatingKey (plugin: PeerTubePlugin) {
    return plugin.name + plugin.type
  }

  private isMajorUpgrade (plugin: PeerTubePlugin) {
    if (!plugin.latestVersion) return false

    const latestMajor = plugin.latestVersion.split('.')[0]
    const currentMajor = plugin.version.split('.')[0]

    return latestMajor > currentMajor
  }
}
