import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { DropdownAction, VideoChannelSyncService } from '@app/shared/shared-main'
import { HTMLServerConfig } from '@shared/models/server'
import { VideoChannelSync } from '@shared/models/videos'
import { SortMeta } from 'primeng/api'
import { mergeMap } from 'rxjs'

@Component({
  templateUrl: './my-video-channels-sync.component.html',
  styleUrls: [ './my-video-channels-sync.component.scss' ]
})
export class MyVideoChannelsSyncComponent extends RestTable implements OnInit {

  error: string = undefined
  channelsSync: VideoChannelSync[]
  totalRecords = 0
  videoChannelSyncActions: DropdownAction<VideoChannelSync>[][] = []
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

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

  httpUploadEnabled () {
    return this.serverConfig.import.videos.http.enabled
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
    return '/my-library/video-channels-sync/create'
  }

  getVideoChannelSyncStateClass (syncId: number) {
    // FIXME
    return 'foobar'
  }

  getIdentifier () {
    return 'MyVideoChannelsSyncComponent'
  }

  getChannelUrl (name: string) {
    return '/c/' + name
  }
}
