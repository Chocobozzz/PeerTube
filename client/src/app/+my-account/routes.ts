import { Routes } from '@angular/router'
import { CanDeactivateGuard, LoginGuard } from '../core'
import { MyAccountAbusesListComponent } from './my-account-abuses/my-account-abuses-list.component'
import { MyAccountApplicationsComponent } from './my-account-applications/my-account-applications.component'
import { MyAccountBlocklistComponent } from './my-account-blocklist/my-account-blocklist.component'
import { MyAccountServerBlocklistComponent } from './my-account-blocklist/my-account-server-blocklist.component'
import { MyAccountNotificationsComponent } from './my-account-notifications/my-account-notifications.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountImportExportComponent, UserImportExportService } from './my-account-import-export'
import { MyAccountComponent } from './my-account.component'
import { MyAccountTwoFactorComponent } from './my-account-settings/my-account-two-factor/my-account-two-factor.component'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { TwoFactorService } from '@app/shared/shared-users/two-factor.service'
import { VideoCommentService } from '@app/shared/shared-video-comment/video-comment.service'
import { PluginPagesComponent } from '@app/shared/shared-plugin-pages/plugin-pages.component'

export default [
  {
    path: '',
    component: MyAccountComponent,
    providers: [
      UserImportExportService,
      TwoFactorService,
      BlocklistService,
      AbuseService,
      VideoCommentService,
      VideoBlockService
    ],
    canActivateChild: [ LoginGuard ],
    children: [
      {
        path: '',
        redirectTo: 'settings',
        pathMatch: 'full'
      },
      {
        path: 'settings',
        component: MyAccountSettingsComponent,
        data: {
          meta: {
            title: $localize`Account settings`
          }
        }
      },

      {
        path: 'two-factor-auth',
        component: MyAccountTwoFactorComponent,
        data: {
          meta: {
            title: $localize`Two factor authentication`
          }
        }
      },

      {
        path: 'video-channels',
        redirectTo: '/my-library/video-channels',
        pathMatch: 'full'
      },

      {
        path: 'video-playlists',
        redirectTo: '/my-library/video-playlists',
        pathMatch: 'full'
      },
      {
        path: 'video-playlists/create',
        redirectTo: '/my-library/video-playlists/create',
        pathMatch: 'full'
      },
      {
        path: 'video-playlists/:videoPlaylistId',
        redirectTo: '/my-library/video-playlists/:videoPlaylistId',
        pathMatch: 'full'
      },
      {
        path: 'video-playlists/update/:videoPlaylistId',
        redirectTo: '/my-library/video-playlists/update/:videoPlaylistId',
        pathMatch: 'full'
      },

      {
        path: 'videos',
        redirectTo: '/my-library/videos',
        pathMatch: 'full'
      },
      {
        path: 'video-imports',
        redirectTo: '/my-library/video-imports',
        pathMatch: 'full'
      },
      {
        path: 'subscriptions',
        redirectTo: '/my-library/subscriptions',
        pathMatch: 'full'
      },
      {
        path: 'ownership',
        redirectTo: '/my-library/ownership',
        pathMatch: 'full'
      },
      {
        path: 'blocklist/accounts',
        component: MyAccountBlocklistComponent,
        data: {
          meta: {
            title: $localize`Muted accounts`
          }
        }
      },
      {
        path: 'blocklist/servers',
        component: MyAccountServerBlocklistComponent,
        data: {
          meta: {
            title: $localize`Muted servers`
          }
        }
      },
      {
        path: 'history/videos',
        redirectTo: '/my-library/history/videos',
        pathMatch: 'full'
      },
      {
        path: 'notifications',
        component: MyAccountNotificationsComponent,
        data: {
          meta: {
            title: $localize`Notifications`
          }
        }
      },
      {
        path: 'abuses',
        component: MyAccountAbusesListComponent,
        data: {
          meta: {
            title: $localize`My abuse reports`
          }
        }
      },
      {
        path: 'applications',
        component: MyAccountApplicationsComponent,
        data: {
          meta: {
            title: $localize`Applications`
          }
        }
      },
      {
        path: 'import-export',
        component: MyAccountImportExportComponent,
        canDeactivate: [ CanDeactivateGuard ],
        data: {
          meta: {
            title: $localize`Import/Export`
          }
        }
      },
      {
        path: 'p',
        children: [
          {
            path: '**',
            component: PluginPagesComponent,
            data: {
              parentRoute: '/my-account',
              pluginScope: 'my-account'
            }
          }
        ]
      }
    ]
  }
] satisfies Routes
