import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { DropdownAction, VideoChannelSyncService } from '@app/shared/shared-main'
import { HTMLServerConfig } from '@shared/models/server'
import { VideoChannelSync, VideoChannelSyncState } from '@shared/models/videos'
import { SortMeta } from 'primeng/api'
import { mergeMap } from 'rxjs'

@Component({
  templateUrl: './my-video-channel-syncs.component.html',
  styleUrls: [ './my-video-channel-syncs.component.scss' ]
})
export class MyVideoChannelSyncsComponent extends RestTable implements OnInit {

  error: string = undefined
  channelsSync: VideoChannelSync[]
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
    private authService: AuthService
  ) {
    super()
  }

  ngOnInit (): void {
    this.serverConfig = this.serverService.getHTMLConfig()
    this.initialize()
    this.videoChannelSyncActions = [
      [
        {
          label: $localize`Delete`,
          iconName: 'delete',
          handler: videoChannelSync => this.deleteSync(videoChannelSync)
        }
      ]
    ]
  }

  protected reloadData (): void {
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
          next: (res) => {
            this.channelsSync = res.data
          },
          error: err => {
            this.error = err.message
          }
        })
  }

  syncEnabled () {
    return this.serverConfig.import.synchronization.enabled
  }

  deleteSync (videoChannelsSync: VideoChannelSync) {
    this.videoChannelsSyncService.deleteSync(videoChannelsSync.id)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Synchronization removed successfully for ${videoChannelsSync.channel.displayName}.`)
          this.reloadData()
        },
        error: (err) => {
          this.error = err.message
        }
      })
  }

  getVideoChannelCreateLink () {
    return '/my-library/video-channel-syncs/create'
  }

  getVideoChannelSyncStateClass (stateId: number) {
    return 'pt-badge ' + MyVideoChannelSyncsComponent.STATE_CLASS_BY_ID[stateId]
  }

  getIdentifier () {
    return 'MyVideoChannelsSyncComponent'
  }

  getChannelUrl (name: string) {
    return '/c/' + name
  }
}
