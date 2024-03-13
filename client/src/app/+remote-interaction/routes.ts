import { Routes } from '@angular/router'
import { LoginGuard } from '@app/core'
import { RemoteInteractionComponent } from './remote-interaction.component'
import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'

export default [
  {
    path: '',
    component: RemoteInteractionComponent,
    providers: [
      FindInBulkService,
      SearchService,
      VideoPlaylistService
    ],
    canActivate: [ LoginGuard ],
    data: {
      meta: {
        title: $localize`Remote interaction`
      }
    }
  }
] satisfies Routes
