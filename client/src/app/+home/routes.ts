import { Routes } from '@angular/router'
import { HomeComponent } from './home.component'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'
import { DynamicElementService } from '@app/shared/shared-custom-markup/dynamic-element.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'

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
      VideoBlockService,
      AbuseService
    ],
    data: {
      meta: {
        title: $localize`Homepage`
      }
    }
  }
] satisfies Routes
