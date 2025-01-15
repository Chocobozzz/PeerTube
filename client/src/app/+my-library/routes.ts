import { Route, Routes, UrlSegment } from '@angular/router'
import { userResolver } from '@app/core/routing/user.resolver'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { WatchedWordsListService } from '@app/shared/standalone-watched-words/watched-words-list.service'
import { LoginGuard } from '../core'
import { CommentsOnMyVideosComponent } from './comments-on-my-videos/comments-on-my-videos.component'
import { AutomaticTagService } from './my-auto-tag-policies/automatic-tag.service'
import { MyAutoTagPoliciesComponent } from './my-auto-tag-policies/my-auto-tag-policies.component'
import { MyFollowersComponent } from './my-follows/my-followers.component'
import { MySubscriptionsComponent } from './my-follows/my-subscriptions.component'
import { MyHistoryComponent } from './my-history/my-history.component'
import { MyLibraryComponent } from './my-library.component'
import { MyOwnershipComponent } from './my-ownership/my-ownership.component'
import { MyVideoChannelSyncsComponent } from './my-video-channel-syncs/my-video-channel-syncs.component'
import { VideoChannelSyncEditComponent } from './my-video-channel-syncs/video-channel-sync-edit/video-channel-sync-edit.component'
import { MyVideoImportsComponent } from './my-video-imports/my-video-imports.component'
import { MyVideoPlaylistCreateComponent } from './my-video-playlists/my-video-playlist-create.component'
import { MyVideoPlaylistElementsComponent } from './my-video-playlists/my-video-playlist-elements.component'
import { MyVideoPlaylistUpdateComponent } from './my-video-playlists/my-video-playlist-update.component'
import { MyVideoPlaylistsComponent } from './my-video-playlists/my-video-playlists.component'
import { MyVideoSpaceComponent } from './my-video-space.component'
import { MyVideosComponent } from './my-videos/my-videos.component'
import { MyWatchedWordsListComponent } from './my-watched-words-list/my-watched-words-list.component'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'

const commonConfig = {
  path: '',
  providers: [
    VideoPlaylistService,
    BlocklistService,
    VideoBlockService,
    AbuseService,
    LiveVideoService,
    UserSubscriptionService,
    AutomaticTagService,
    WatchedWordsListService,
    BulkService,
    VideoCommentService
  ],
  resolve: {
    user: userResolver
  },
  canActivateChild: [ LoginGuard ]
}

const videoSpaceRoutes = [
  // ---------------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------------

  {
    path: '',
    redirectTo: 'video-channels',
    pathMatch: 'full'
  },

  {
    path: 'video-channels',
    loadChildren: () => import('./+my-video-channels/routes')
  },

  {
    path: 'followers',
    component: MyFollowersComponent,
    data: {
      meta: {
        title: $localize`My followers`
      }
    }
  },

  {
    path: 'video-channel-syncs',
    component: MyVideoChannelSyncsComponent,
    data: {
      meta: {
        title: $localize`My synchronizations`
      }
    }
  },

  {
    path: 'video-channel-syncs/create',
    component: VideoChannelSyncEditComponent,
    data: {
      meta: {
        title: $localize`Create new synchronization`
      }
    }
  },

  // ---------------------------------------------------------------------------
  // Videos
  // ---------------------------------------------------------------------------

  {
    path: 'videos/comments',
    redirectTo: 'comments-on-my-videos',
    pathMatch: 'full'
  },

  {
    path: 'comments-on-my-videos',
    component: CommentsOnMyVideosComponent,
    data: {
      meta: {
        title: $localize`Comments on your videos`
      }
    }
  },

  {
    path: 'watched-words/list',
    component: MyWatchedWordsListComponent,
    data: {
      meta: {
        title: $localize`Your watched words`
      }
    }
  },

  {
    path: 'auto-tag-policies',
    component: MyAutoTagPoliciesComponent,
    data: {
      meta: {
        title: $localize`Your automatic tag policies`
      }
    }
  },

  {
    path: 'videos',
    component: MyVideosComponent,
    data: {
      meta: {
        title: $localize`My videos`
      },
      reuse: {
        enabled: true,
        key: 'my-videos-list'
      }
    }
  },
  {
    path: 'video-imports',
    component: MyVideoImportsComponent,
    data: {
      meta: {
        title: $localize`My video imports`
      }
    }
  },
  {
    path: 'ownership',
    component: MyOwnershipComponent,
    data: {
      meta: {
        title: $localize`Ownership changes`
      }
    }
  }
] satisfies Routes

const libraryRoutes = [

  // ---------------------------------------------------------------------------
  // Playlists
  // ---------------------------------------------------------------------------

  {
    path: 'video-playlists',
    component: MyVideoPlaylistsComponent,
    data: {
      meta: {
        title: $localize`My playlists`
      }
    }
  },
  {
    path: 'video-playlists/create',
    component: MyVideoPlaylistCreateComponent,
    data: {
      meta: {
        title: $localize`Create a new playlist`
      }
    }
  },
  {
    path: 'video-playlists/:videoPlaylistId',
    component: MyVideoPlaylistElementsComponent,
    data: {
      meta: {
        title: $localize`Playlist elements`
      }
    }
  },
  {
    path: 'video-playlists/update/:videoPlaylistId',
    component: MyVideoPlaylistUpdateComponent,
    data: {
      meta: {
        title: $localize`Update playlist`
      }
    }
  },

  // ---------------------------------------------------------------------------
  // My subscriptions/history
  // ---------------------------------------------------------------------------

  {
    path: 'subscriptions',
    component: MySubscriptionsComponent,
    data: {
      meta: {
        title: $localize`My subscriptions`
      }
    }
  },

  {
    path: 'history/videos',
    component: MyHistoryComponent,
    data: {
      meta: {
        title: $localize`My video history`
      },
      reuse: {
        enabled: true,
        key: 'my-videos-history-list'
      }
    }
  }
]

function isVideoSpaceRoute (segments: UrlSegment[]) {
  if (segments.length === 0) return false

  const rootPath = segments[0].path

  return videoSpaceRoutes.some(r => r.path === rootPath || r.path.startsWith(`${rootPath}/`))
}

export default [
  {
    ...commonConfig,

    component: MyVideoSpaceComponent,
    canMatch: [
      (_route: Route, segments: UrlSegment[]) => {
        return isVideoSpaceRoute(segments)
      }
    ],

    children: videoSpaceRoutes
  },
  {
    ...commonConfig,

    component: MyLibraryComponent,
    canMatch: [
      (_route: Route, segments: UrlSegment[]) => {
        return !isVideoSpaceRoute(segments)
      }
    ],
    children: libraryRoutes
  }
] satisfies Routes
