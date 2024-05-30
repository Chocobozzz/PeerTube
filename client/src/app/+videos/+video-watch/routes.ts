import { Routes } from '@angular/router'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { OverviewService } from '../video-list'
import { VideoRecommendationService } from './shared'
import { VideoWatchComponent } from './video-watch.component'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'

export default [
  {
    path: '',
    providers: [
      OverviewService,
      UserSubscriptionService,
      VideoPlaylistService,
      BlocklistService,
      VideoBlockService,
      LiveVideoService,
      VideoCommentService,
      VideoRecommendationService,
      SearchService,
      AbuseService,
      UserAdminService,
      BulkService
    ],
    children: [
      {
        path: 'p/:playlistId',
        component: VideoWatchComponent
      },
      {
        path: ':videoId/comments/:commentId',
        redirectTo: ':videoId'
      },
      {
        path: ':videoId',
        component: VideoWatchComponent
      }
    ]
  }
] satisfies Routes
