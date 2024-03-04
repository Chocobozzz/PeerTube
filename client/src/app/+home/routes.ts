import { Routes } from '@angular/router'
import { HomeComponent } from './home.component'
import { CustomPageService } from '../shared/shared-main/custom-page'
import { CustomMarkupService, DynamicElementService } from '@app/shared/shared-custom-markup'
import { FindInBulkService, SearchService } from '@app/shared/shared-search'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'
import { BlocklistService, VideoBlockService } from '@app/shared/shared-moderation'

export default [
  {
    path: '',
    component: HomeComponent,
    providers: [
      CustomPageService,
      FindInBulkService,
      SearchService,
      VideoPlaylistService,
      CustomMarkupService,
      DynamicElementService,
      BlocklistService,
      VideoBlockService
    ],
    data: {
      meta: {
        title: $localize`Homepage`
      }
    }
  }
] satisfies Routes
