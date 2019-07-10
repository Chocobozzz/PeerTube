import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { ConfirmService, ServerService } from '../../../core'
import { RestPagination, RestTable, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { User } from '../../../../../../shared'
import { UserBanModalComponent } from '@app/shared/moderation'
import { DropdownAction } from '@app/shared/buttons/action-dropdown.component'
import { PluginType } from '@shared/models/plugins/plugin.type'
import { PluginApiService } from '@app/+admin/plugins/shared/plugin-api.service'

@Component({
  selector: 'my-plugin-search',
  templateUrl: './plugin-search.component.html',
  styleUrls: [ './plugin-search.component.scss' ]
})
export class PluginSearchComponent implements OnInit {
  pluginTypeOptions: { label: string, value: PluginType }[] = []

  constructor (
    private i18n: I18n,
    private pluginService: PluginApiService
  ) {
    this.pluginTypeOptions = this.pluginService.getPluginTypeOptions()
  }

  ngOnInit () {
  }
}
