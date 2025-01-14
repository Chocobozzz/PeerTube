import { NgClass, NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { VideoChannelSyncService } from '@app/shared/shared-main/channel/video-channel-sync.service'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { AutoColspanDirective } from '@app/shared/shared-main/common/auto-colspan.directive'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, VideoChannelSync, VideoChannelSyncState, VideoChannelSyncStateType } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { mergeMap } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../shared/shared-main/buttons/action-dropdown.component'

@Component({
  templateUrl: './my-video-channel-syncs.component.html',
  standalone: true,
  imports: [
    NgIf,
    GlobalIconComponent,
    TableModule,
    SharedModule,
    RouterLink,
    NgbTooltip,
    ActionDropdownComponent,
    ActorAvatarComponent,
    NgClass,
    PTDatePipe,
    AlertComponent,
    AutoColspanDirective
  ]
})
export class MyVideoChannelSyncsComponent extends RestTable implements OnInit {
  error: string

  channelSyncs: VideoChannelSync[] = []
  totalRecords = 0

  videoChannelSyncActions: DropdownAction<VideoChannelSync>[][] = []
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  private static STATE_CLASS_BY_ID = {
    [VideoChannelSyncState.FAILED]: 'badge-red',
    [VideoChannelSyncState.PROCESSING]: 'badge-blue',
    [VideoChannelSyncState.SYNCED]: 'badge-green',
    [VideoChannelSyncState.WAITING_FIRST_RUN]: 'badge-yellow'
  }

  private serverConfig: HTMLServerConfig

  constructor (
    private videoChannelsSyncService: VideoChannelSyncService,
    private serverService: ServerService,
    private notifier: Notifier,
    private authService: AuthService,
    private videoChannelService: VideoChannelService
  ) {
    super()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()
    this.initialize()

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

  protected reloadDataInternal () {
    this.error = undefined

    this.authService.userInformationLoaded
      .pipe(mergeMap(() => {
        const user = this.authService.getUser()
        return this.videoChannelsSyncService.listAccountVideoChannelsSyncs({
          sort: this.sort,
          account: user.account,
          pagination: this.pagination
        })
      }))
      .subscribe({
        next: res => {
          this.channelSyncs = res.data
          this.totalRecords = res.total
        },
        error: err => {
          this.error = err.message
        }
      })
  }

  syncEnabled () {
    return this.serverConfig.import.videoChannelSynchronization.enabled
  }

  deleteSync (videoChannelSync: VideoChannelSync) {
    this.videoChannelsSyncService.deleteSync(videoChannelSync.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Synchronization removed successfully for ${videoChannelSync.channel.displayName}.`)
          this.reloadData()
        },
        error: err => {
          this.error = err.message
        }
      })
  }

  fullySynchronize (videoChannelSync: VideoChannelSync) {
    this.videoChannelService.importVideos(videoChannelSync.channel.name, videoChannelSync.externalChannelUrl, videoChannelSync.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Full synchronization requested successfully for ${videoChannelSync.channel.displayName}.`)
        },
        error: err => {
          this.error = err.message
        }
      })
  }

  getSyncCreateLink () {
    return '/my-library/video-channel-syncs/create'
  }

  getSyncStateClass (stateId: VideoChannelSyncStateType) {
    return [ 'pt-badge', MyVideoChannelSyncsComponent.STATE_CLASS_BY_ID[stateId] ]
  }

  getIdentifier () {
    return 'MyVideoChannelsSyncComponent'
  }

  getChannelUrl (name: string) {
    return '/c/' + name
  }
}
