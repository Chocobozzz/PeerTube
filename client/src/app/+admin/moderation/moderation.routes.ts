import { Routes } from '@angular/router'
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from '@app/+admin/moderation/instance-blocklist'
import { ModerationComponent } from '@app/+admin/moderation/moderation.component'
import { AbuseListComponent } from '@app/+admin/moderation/abuse-list'
import { VideoBlockListComponent } from '@app/+admin/moderation/video-block-list'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@shared/models'

export const ModerationRoutes: Routes = [
  {
    path: 'moderation',
    component: ModerationComponent,
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
            title: 'Reports'
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
            title: 'Videos blocked'
          }
        }
      },
      {
        path: 'blocklist/accounts',
        component: InstanceAccountBlocklistComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_ACCOUNTS_BLOCKLIST,
          meta: {
            title: 'Muted accounts'
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
            title: 'Muted instances'
          }
        }
      }
    ]
  }
]
