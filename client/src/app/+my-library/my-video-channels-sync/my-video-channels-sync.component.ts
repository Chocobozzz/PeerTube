import { Component, OnInit } from '@angular/core'
import { Notifier, RestPagination, RestTable, ServerService } from '@app/core'
import { DropdownAction, VideoChannelSyncService } from '@app/shared/shared-main'
import { HTMLServerConfig } from '@shared/models/server'
import { VideoChannel, VideoChannelSync, VideoChannelSyncState } from '@shared/models/videos'
import { SortMeta } from 'primeng/api'

@Component({
  templateUrl: './my-video-channels-sync.component.html',
  styleUrls: [ './my-video-channels-sync.component.scss' ]
})
export class MyVideoChannelsSyncComponent extends RestTable implements OnInit {
  private serverConfig: HTMLServerConfig
  channelsSync: VideoChannelSync[] = [ {
    id: 42,
    externalChannelUrl: 'https://yt.com/UC_yolo',
    createdAt: '2021-01-01',
    updatedAt: '2021-01-01',
    state: {
      id: VideoChannelSyncState.SYNCED,
      label: 'Synchronized'
    }
  } ]
  channelsById: Map<number, VideoChannel> = new Map([ [ 42, {
    id: 42,
    displayName: 'Fancy Channel',
    createdAt: '2021-01-01',
    updatedAt: '2021-01-01',
    externalChannelUrl: null,
    avatar: null,
    avatars: null,
    banner: null,
    banners: null,
    description: '',
    followersCount: 1,
    followingCount: 1,
    host: 'localhost:3000',
    isLocal: true,
    name: 'fancy_channel',
    support: '',
    url: ''
  } ] ])
  totalRecords = 0
  videoChannelSyncActions: DropdownAction<VideoChannelSync>[][] = []
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private videoChannelsSyncService: VideoChannelSyncService,
    private serverService: ServerService,
    private notifier: Notifier
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
    // TODO
    return
  }

  httpUploadEnabled () {
    return this.serverConfig.import.videos.http.enabled
  }

  deleteSync (videoChannelsSync: VideoChannelSync) {
    this.videoChannelsSyncService.deleteSync(videoChannelsSync.id)
      .subscribe({
        next: () => {
          this.channelsSync = this.channelsSync.filter(item => item !== videoChannelsSync)
          this.notifier.success($localize`TODO ${videoChannelsSync.id}`)
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

  getChannelUrl (id: number) {
    return '/c/' + this.channelsById.get(id).name
  }

  getChannelName (id: number) {
    return this.channelsById.get(id).displayName
  }

}
