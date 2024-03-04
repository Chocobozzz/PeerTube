import { Routes } from '@angular/router'
import { ConfigRoutes, EditConfigurationService } from '@app/+admin/config'
import { ModerationRoutes } from '@app/+admin/moderation/moderation.routes'
import { PluginsRoutes } from '@app/+admin/plugins/plugins.routes'
import { DebugService, JobService, LogsService, RunnerService, SystemRoutes } from '@app/+admin/system'
import { AdminComponent } from './admin.component'
import { FollowsRoutes } from './follows'
import { OverviewRoutes, VideoAdminService } from './overview'
import { TwoFactorService, UserAdminService } from '@app/shared/shared-users'
import { AbuseService, BlocklistService, BulkService, VideoBlockService } from '@app/shared/shared-moderation'
import { CustomMarkupService, DynamicElementService } from '@app/shared/shared-custom-markup'
import { InstanceFollowService } from '@app/shared/shared-instance'
import { CustomPageService } from '@app/shared/shared-main/custom-page'
import { VideoCommentService } from '@app/shared/shared-video-comment'
import { AdminRegistrationService } from './moderation/registration-list'
import { PluginApiService } from './plugins/shared/plugin-api.service'
import { ConfigService } from './config/shared/config.service'
import { FindInBulkService, SearchService } from '@app/shared/shared-search'
import { VideoPlaylistService } from '@app/shared/shared-video-playlist'

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
      VideoPlaylistService
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
