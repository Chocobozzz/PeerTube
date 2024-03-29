import { Routes } from '@angular/router'
import { ConfigRoutes, EditConfigurationService } from '@app/+admin/config'
import { ModerationRoutes } from '@app/+admin/moderation/moderation.routes'
import { PluginsRoutes } from '@app/+admin/plugins/plugins.routes'
import { DebugService, JobService, LogsService, RunnerService, SystemRoutes } from '@app/+admin/system'
import { AdminComponent } from './admin.component'
import { FollowsRoutes } from './follows'
import { OverviewRoutes, VideoAdminService } from './overview'
import { AdminRegistrationService } from './moderation/registration-list'
import { PluginApiService } from './plugins/shared/plugin-api.service'
import { ConfigService } from './config/shared/config.service'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'
import { DynamicElementService } from '@app/shared/shared-custom-markup/dynamic-element.service'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { FindInBulkService } from '@app/shared/shared-search/find-in-bulk.service'
import { SearchService } from '@app/shared/shared-search/search.service'
import { TwoFactorService } from '@app/shared/shared-users/two-factor.service'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist/video-playlist.service'
import { WatchedWordsListService } from '@app/shared/standalone-watched-words/watched-words-list.service'

export default [
  {
    path: '',
    component: AdminComponent,
    providers: [
      BlocklistService,
      UserAdminService,
      BulkService,
      AdminRegistrationService,
      CustomMarkupService,
      CustomPageService,
      DebugService,
      EditConfigurationService,
      InstanceFollowService,
      JobService,
      LogsService,
      PluginApiService,
      RunnerService,
      TwoFactorService,
      UserAdminService,
      VideoAdminService,
      VideoBlockService,
      VideoCommentService,
      ConfigService,
      AbuseService,
      DynamicElementService,
      FindInBulkService,
      SearchService,
      VideoPlaylistService,
      WatchedWordsListService
    ],
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },

      ...FollowsRoutes,
      ...OverviewRoutes,
      ...ModerationRoutes,
      ...SystemRoutes,
      ...ConfigRoutes,
      ...PluginsRoutes
    ]
  }
] satisfies Routes
