import { Routes } from '@angular/router'
import { AbuseListComponent } from '@app/+admin/moderation/abuse-list'
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from '@app/+admin/moderation/instance-blocklist'
import { VideoBlockListComponent } from '@app/+admin/moderation/video-block-list'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'
import { RegistrationListComponent } from './registration-list'
import { WatchedWordsListAdminComponent } from './watched-words-list/watched-words-list-admin.component'

export const moderationRoutes: Routes = [
  {
    path: 'moderation',
    children: [
      {
        path: '',
        redirectTo: 'abuses/list',
        pathMatch: 'full'
      },
      {
        path: 'video-abuses',
        redirectTo: 'abuses/list',
        pathMatch: 'full'
      },
      {
        path: 'video-abuses/list',
        redirectTo: 'abuses/list',
        pathMatch: 'full'
      },
      {
        path: 'abuses/list',
        component: AbuseListComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_ABUSES,
          meta: {
            title: $localize`Reports`
          }
        }
      },

      {
        path: 'video-blacklist',
        redirectTo: 'video-blocks/list',
        pathMatch: 'full'
      },
      {
        path: 'video-auto-blacklist',
        redirectTo: 'video-blocks/list',
        pathMatch: 'full'
      },
      {
        path: 'video-auto-blacklist/list',
        redirectTo: 'video-blocks/list',
        pathMatch: 'full'
      },
      {
        path: 'video-blacklist',
        redirectTo: 'video-blocks/list',
        pathMatch: 'full'
      },
      {
        path: 'video-blocks/list',
        component: VideoBlockListComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_VIDEO_BLACKLIST,
          meta: {
            title: $localize`Blocked videos`
          }
        }
      },

      {
        path: 'registrations/list',
        component: RegistrationListComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_REGISTRATIONS,
          meta: {
            title: $localize`User registrations`
          }
        }
      },

      // We moved this component in admin overview pages
      {
        path: 'video-comments',
        redirectTo: 'video-comments/list',
        pathMatch: 'full'
      },
      {
        path: 'video-comments/list',
        redirectTo: '/admin/overview/comments/list',
        pathMatch: 'full'
      },

      {
        path: 'blocklist/accounts',
        component: InstanceAccountBlocklistComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_ACCOUNTS_BLOCKLIST,
          meta: {
            title: $localize`Muted accounts`
          }
        }
      },
      {
        path: 'blocklist/servers',
        component: InstanceServerBlocklistComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_SERVERS_BLOCKLIST,
          meta: {
            title: $localize`Muted instances`
          }
        }
      },

      {
        path: 'watched-words/list',
        component: WatchedWordsListAdminComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_INSTANCE_WATCHED_WORDS,
          meta: {
            title: $localize`Watched words`
          }
        }
      }
    ]
  }
]
