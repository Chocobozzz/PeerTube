import { Route, Routes, UrlSegment } from '@angular/router'
import { configRoutes, EditConfigurationService } from '@app/+admin/config'
import { moderationRoutes } from '@app/+admin/moderation/moderation.routes'
import { pluginsRoutes } from '@app/+admin/plugins/plugins.routes'
import { DebugService, JobService, LogsService, RunnerService, systemRoutes } from '@app/+admin/system'
import { CustomMarkupService } from '@app/shared/shared-custom-markup/custom-markup.service'
import { DynamicElementService } from '@app/shared/shared-custom-markup/dynamic-element.service'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
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
import { AdminModerationComponent } from './admin-moderation.component'
import { AdminOverviewComponent } from './admin-overview.component'
import { AdminSettingsComponent } from './admin-settings.component'
import { ConfigService } from './config/shared/config.service'
import { followsRoutes } from './follows'
import { AdminRegistrationService } from './moderation/registration-list'
import { overviewRoutes, VideoAdminService } from './overview'
import { PluginApiService } from './plugins/shared/plugin-api.service'

const commonConfig = {
  path: '',
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
  ]
}

function isOverviewRoute (segments: UrlSegment[]) {
  if (segments.length === 0) return false

  const rootPath = segments[0].path

  return overviewRoutes.some(r => r.path === rootPath || r.path.startsWith(`${rootPath}/`))
}

function isModerationRoute (segments: UrlSegment[]) {
  if (segments.length === 0) return false

  const rootPath = segments[0].path

  return moderationRoutes.some(r => r.path === rootPath || r.path.startsWith(`${rootPath}/`))
}

function baseSettingsPathRedirect ({ url }: { url: UrlSegment[] }) {
  return `/admin/settings/${url.map(u => u.path).join('/')}`
}

export default [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview'
  },

  {
    ...commonConfig,

    component: AdminModerationComponent,
    canMatch: [
      (_route: Route, segments: UrlSegment[]) => {
        return isModerationRoute(segments)
      }
    ],

    children: moderationRoutes
  },

  {
    ...commonConfig,

    component: AdminOverviewComponent,
    canMatch: [
      (_route: Route, segments: UrlSegment[]) => {
        return isOverviewRoute(segments)
      }
    ],

    children: overviewRoutes
  },

  {
    path: 'config',
    pathMatch: 'prefix',
    redirectTo: baseSettingsPathRedirect
  },

  {
    path: 'follows',
    pathMatch: 'prefix',
    redirectTo: baseSettingsPathRedirect
  },

  {
    path: 'system',
    pathMatch: 'prefix',
    redirectTo: baseSettingsPathRedirect
  },

  {
    path: 'plugins',
    pathMatch: 'prefix',
    redirectTo: baseSettingsPathRedirect
  },

  {
    ...commonConfig,

    path: 'settings',
    component: AdminSettingsComponent,
    canMatch: [
      (_route: Route, segments: UrlSegment[]) => {
        return !isOverviewRoute(segments) && !isModerationRoute(segments)
      }
    ],

    children: [
      {
        path: '',
        redirectTo: 'config',
        pathMatch: 'full'
      },

      ...configRoutes,
      ...followsRoutes,
      ...systemRoutes,
      ...pluginsRoutes
    ]
  }
] satisfies Routes
