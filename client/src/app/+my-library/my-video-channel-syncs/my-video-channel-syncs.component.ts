import { CommonModule } from '@angular/common'
import { Component, OnInit, inject, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService, Notifier, ServerService } from '@app/core'
import { VideoChannelSyncService } from '@app/shared/shared-main/channel/video-channel-sync.service'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { HTMLServerConfig, VideoChannelSync, VideoChannelSyncState, VideoChannelSyncStateType } from '@peertube/peertube-models'
import { first, mergeMap } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../shared/shared-main/buttons/action-dropdown.component'
import { NumberFormatterPipe } from '../../shared/shared-main/common/number-formatter.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '../../shared/shared-tables/table.component'

@Component({
  templateUrl: './my-video-channel-syncs.component.html',
  imports: [
    CommonModule,
    GlobalIconComponent,
    RouterLink,
    ActionDropdownComponent,
    ActorAvatarComponent,
    PTDatePipe,
    TableComponent,
    NumberFormatterPipe
  ]
})
export class MyVideoChannelSyncsComponent implements OnInit {
  private videoChannelsSyncService = inject(VideoChannelSyncService)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)
  private authService = inject(AuthService)
  private videoChannelService = inject(VideoChannelService)

  readonly table = viewChild<TableComponent<VideoChannelSync>>('table')

  videoChannelSyncActions: DropdownAction<VideoChannelSync>[][] = []

  private static STATE_CLASS_BY_ID = {
    [VideoChannelSyncState.FAILED]: 'badge-red',
    [VideoChannelSyncState.PROCESSING]: 'badge-blue',
    [VideoChannelSyncState.SYNCED]: 'badge-green',
    [VideoChannelSyncState.WAITING_FIRST_RUN]: 'badge-yellow'
  }

  private serverConfig: HTMLServerConfig

  columns: TableColumnInfo<string>[] = [
    { id: 'externalChannelUrl', label: $localize`External Channel`, sortable: true },
    { id: 'videoChannel', label: $localize`Channel`, sortable: true },
    { id: 'state', label: $localize`State`, sortable: true },
    { id: 'createdAt', label: $localize`Created`, sortable: true },
    { id: 'lastSyncAt', label: $localize`Last synchronization at`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.videoChannelSyncActions = [
      [
        {
          label: $localize`List imports`,
          linkBuilder: () => [ '/my-library/video-imports' ],
          queryParamsBuilder: sync => ({ search: `videoChannelSyncId:${sync.id}` }),
          iconName: 'cloud-download'
        }
      ],
      [
        {
          label: $localize`Delete`,
          iconName: 'delete',
          handler: videoChannelSync => this.deleteSync(videoChannelSync)
        },
        {
          label: $localize`Fully synchronize the channel`,
          description: $localize`This fetches any missing videos on the local channel`,
          iconName: 'refresh',
          handler: videoChannelSync => this.fullySynchronize(videoChannelSync)
        }
      ]
    ]
  }

  private _dataLoader (options: DataLoaderOptions) {
    return this.authService.userInformationLoaded
      .pipe(
        first(),
        mergeMap(() => {
          return this.videoChannelsSyncService.listAccountVideoChannelsSyncs({
            sort: options.sort,
            pagination: options.pagination,
            account: this.authService.getUser().account
          })
        })
      )
  }

  syncEnabled () {
    return this.serverConfig.import.videoChannelSynchronization.enabled
  }

  deleteSync (videoChannelSync: VideoChannelSync) {
    this.videoChannelsSyncService.deleteSync(videoChannelSync.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Synchronization removed successfully for ${videoChannelSync.channel.displayName}.`)
          this.table().loadData()
        },
        error: err => this.notifier.error(err.message)
      })
  }

  fullySynchronize (videoChannelSync: VideoChannelSync) {
    this.videoChannelService.importVideos(videoChannelSync.channel.name, videoChannelSync.externalChannelUrl, videoChannelSync.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Full synchronization requested successfully for ${videoChannelSync.channel.displayName}.`)
        },
        error: err => this.notifier.error(err.message)
      })
  }

  getSyncCreateLink () {
    return '/my-library/video-channel-syncs/create'
  }

  getSyncStateClass (stateId: VideoChannelSyncStateType) {
    return [ 'pt-badge', MyVideoChannelSyncsComponent.STATE_CLASS_BY_ID[stateId] ]
  }

  getChannelUrl (name: string) {
    return '/c/' + name
  }
}
