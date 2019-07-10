import { Component, OnInit } from '@angular/core'
import { PluginType } from '@shared/models/plugins/plugin.type'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'
import { ComponentPagination, hasMoreItems } from '@app/shared/rest/component-pagination.model'
import { Notifier } from '@app/core'
import { PeerTubePlugin } from '@shared/models/plugins/peertube-plugin.model'

@Component({
  selector: 'my-plugin-list-installed',
  templateUrl: './plugin-list-installed.component.html',
  styleUrls: [ './plugin-list-installed.component.scss' ]
})
export class PluginListInstalledComponent implements OnInit {
  pluginTypeOptions: { label: string, value: PluginType }[] = []
  pluginType: PluginType = PluginType.PLUGIN

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10
  }
  sort = 'name'

  plugins: PeerTubePlugin[] = []

  constructor (
    private i18n: I18n,
    private pluginService: PluginApiService,
    private notifier: Notifier
  ) {
    this.pluginTypeOptions = this.pluginService.getPluginTypeOptions()
  }

  ngOnInit () {
    this.reloadPlugins()
  }

  reloadPlugins () {
    this.pagination.currentPage = 1
    this.plugins = []

    this.loadMorePlugins()
  }

  loadMorePlugins () {
    this.pluginService.getPlugins(this.pluginType, this.pagination, this.sort)
        .subscribe(
          res => {
            this.plugins = this.plugins.concat(res.data)
            this.pagination.totalItems = res.total
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
      return this.i18n('You don\'t have plugins installed yet.')
    }

    return this.i18n('You don\'t have themes installed yet.')
  }
}
