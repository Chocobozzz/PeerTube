import { Component, OnInit } from '@angular/core'
import { RestPagination, RestTable } from '@app/core'
import { DropdownAction } from '@app/shared/shared-main'
import { VideoChannelsSync, VideoChannelsSyncState } from '@shared/models/videos'
import { SortMeta } from 'primeng/api'

@Component({
  templateUrl: './my-video-channels-sync.component.html',
  styleUrls: [ './my-video-channels-sync.component.scss' ]
})
export class MyVideoChannelsSyncComponent extends RestTable implements OnInit {
  channelsSync: VideoChannelsSync[] = [ {
    id: 42,
    externalChannelUrl: 'https://yt.com/UC_yolo',
    createdAt: '2021-01-01',
    updatedAt: '2021-01-01',
    state: {
      id: VideoChannelsSyncState.SYNCED,
      label: 'Synchronized'
    }
  } ]
  totalRecords = 0
  videoChannelSyncActions: DropdownAction<VideoChannelsSync>[][] = []
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  ngOnInit (): void {
    this.initialize()
    this.videoChannelSyncActions = [
      [
        {
          label: $localize`Delete this synchonization`,
          handler: videoChannelSync => this.deleteSync(videoChannelSync)
        },

        {
          label: $localize`Edit this synchronization`,
          description: $localize`Change synchronization settings`,
          handler: videoChannelSync => this.editSync(videoChannelSync)
        }
      ]
    ]
  }

  protected reloadData (): void {
    return
  }

  deleteSync (videoChannelsSync: VideoChannelsSync) {
    this.channelsSync = this.channelsSync.filter(item => item !== videoChannelsSync)
  }

  editSync (videoChannelSync: VideoChannelsSync) {
    // FIXME
    location.href = '/yolo/coincoin/' + videoChannelSync.id
  }

  getVideoChannelSyncStateClass (syncId: number) {
    // FIXME
    return 'yolo'
  }

  getIdentifier () {
    return 'MyVideoChannelsSyncComponent'
  }

}
