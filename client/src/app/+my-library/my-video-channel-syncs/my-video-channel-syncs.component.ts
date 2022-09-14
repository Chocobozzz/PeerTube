import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { DropdownAction, VideoChannelService, VideoChannelSyncService } from '@app/shared/shared-main'
import { HTMLServerConfig } from '@shared/models/server'
import { VideoChannelSync, VideoChannelSyncState } from '@shared/models/videos'
import { SortMeta } from 'primeng/api'
import { mergeMap } from 'rxjs'

@Component({
  templateUrl: './my-video-channel-syncs.component.html',
  styleUrls: [ './my-video-channel-syncs.component.scss' ]
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

  protected reloadData () {
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

  getSyncStateClass (stateId: number) {
    return [ 'pt-badge', MyVideoChannelSyncsComponent.STATE_CLASS_BY_ID[stateId] ]
  }

  getIdentifier () {
    return 'MyVideoChannelsSyncComponent'
  }

  getChannelUrl (name: string) {
    return '/c/' + name
  }
}
