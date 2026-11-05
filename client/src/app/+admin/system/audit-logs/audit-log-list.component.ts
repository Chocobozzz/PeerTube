import { NgClass } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { AuditLogActionType, AuditLogEntityTypeType } from '@peertube/peertube-models'
import { AdvancedFilterDef } from '../../../shared/shared-forms/advanced-input-filter.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptionsBase, TableColumnInfo, TableComponent } from '../../../shared/shared-tables/table.component'
import { AuditLogService } from './audit-log.service'

type DataLoaderParameter = Parameters<AuditLogListComponent['_dataLoader']>[0]

type ColumnName = 'createdAt' | 'user' | 'action' | 'entityType' | 'entity' | 'entityId' | 'ip'

@Component({
  selector: 'my-audit-log-list',
  templateUrl: './audit-log-list.component.html',
  styleUrls: [ './audit-log-list.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    NgClass,
    RouterLink,
    TableComponent,
    GlobalIconComponent,
    PTDatePipe,
    NumberFormatterPipe
  ]
})
export class AuditLogListComponent {
  private auditLogService = inject(AuditLogService)

  private entityTypeLabels: Record<AuditLogEntityTypeType, string> = {
    'video': $localize`Video`,
    'video-import': $localize`Video import`,
    'video-live': $localize`Live settings`,
    'video-source': $localize`Video source file`,
    'video-file': $localize`Video file`,
    'video-caption': $localize`Video caption`,
    'video-chapters': $localize`Video chapters`,
    'video-password': $localize`Video password`,
    'video-embed-privacy': $localize`Video embed privacy`,
    'video-transcoding': $localize`Video transcoding`,
    'video-transcription': $localize`Video transcription`,
    'video-studio-edition': $localize`Video studio edition`,
    'video-player-settings': $localize`Video player settings`,
    'ownership-change': $localize`Ownership change`,
    'comment': $localize`Comment`,

    'channel': $localize`Channel`,
    'channel-sync': $localize`Channel synchronization`,
    'channel-videos-import': $localize`Channel videos import`,
    'channel-collaborator': $localize`Channel collaborator`,
    'channel-player-settings': $localize`Channel player settings`,
    'channel-playlists-order': $localize`Channel playlists order`,
    'playlist': $localize`Playlist`,
    'playlist-element': $localize`Playlist element`,
    'playlist-elements-order': $localize`Playlist elements order`,

    'user': $localize`User`,
    'registration': $localize`Registration request`,
    'password-reset': $localize`Password reset request`,
    'token-session': $localize`Login session`,
    'failed-login': $localize`Failed login`,
    'scoped-token': $localize`Scoped token`,
    'user-export': $localize`User export`,
    'user-import': $localize`User import`,

    'abuse': $localize`Abuse report`,
    'abuse-message': $localize`Abuse message`,
    'video-block': $localize`Video block`,
    'account-block': $localize`Account mute`,
    'server-block': $localize`Server mute`,
    'blocklist-subscription': $localize`Blocklist subscription`,
    'watched-words-list': $localize`Watched words list`,
    'watched-words-subscription': $localize`Watched words subscription`,
    'automatic-tag-policy': $localize`Automatic tag policy`,

    'config': $localize`Instance configuration`,
    'instance-image': $localize`Instance image`,
    'instance-homepage': $localize`Instance homepage`,
    'instance-host': $localize`Instance host`,
    'plugin': $localize`Plugin or theme`,
    'follow': $localize`Follow`,
    'server-redundancy': $localize`Server redundancy`,
    'video-redundancy': $localize`Video redundancy`,
    'job-queue': $localize`Job queue`,
    'job': $localize`Job`,
    'runner': $localize`Remote runner`,
    'runner-registration-token': $localize`Runner registration token`,
    'debug-command': $localize`Debug command`,
    'storage-prune': $localize`Storage prune`
  }

  private entityTypes = Object.entries(this.entityTypeLabels).map(([ id, label ]) => ({ id: id as AuditLogEntityTypeType, label }))

  private actions: { id: AuditLogActionType, label: string }[] = [
    { id: 'create', label: $localize`Create` },
    { id: 'update', label: $localize`Update` },
    { id: 'delete', label: $localize`Delete` }
  ]

  inputFilters: AdvancedFilterDef<DataLoaderParameter>[] = [
    {
      type: 'select',
      key: 'entityType',
      title: $localize`Entity type`,
      clearable: true,
      filter: true,
      items: this.entityTypes
    },
    {
      type: 'text',
      key: 'entityId',
      title: $localize`Entity id`,
      constraint: 'numeric'
    },
    {
      type: 'select',
      key: 'action',
      title: $localize`Action`,
      clearable: true,
      items: this.actions.map(a => ({ ...a, classes: [ 'pt-badge', this.getActionBadgeColor(a.id) ] }))
    }
  ]

  columns: TableColumnInfo<ColumnName>[] = [
    { id: 'createdAt', label: $localize`Date`, sortable: true },
    { id: 'user', label: $localize`User`, sortable: false },
    { id: 'action', label: $localize`Action`, sortable: false },
    { id: 'entityType', label: $localize`Entity type`, sortable: false },
    { id: 'entity', label: $localize`Entity`, sortable: false },
    { id: 'entityId', label: $localize`Entity id`, sortable: false },
    { id: 'ip', label: $localize`IP`, sortable: false }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  getActionBadgeColor (action: AuditLogActionType) {
    switch (action) {
      case 'create':
        return 'badge-success'

      case 'delete':
        return 'badge-danger'

      default:
        return 'badge-info'
    }
  }

  getActionLabel (action: AuditLogActionType) {
    return this.actions.find(a => a.id === action)?.label ?? action
  }

  getEntityTypeLabel (entityType: AuditLogEntityTypeType) {
    return this.entityTypeLabels[entityType] ?? entityType
  }

  private _dataLoader (
    options: DataLoaderOptionsBase & {
      entityType?: AuditLogEntityTypeType
      entityId?: number
      action?: AuditLogActionType
    }
  ) {
    return this.auditLogService.listAuditLogs(options)
  }
}
