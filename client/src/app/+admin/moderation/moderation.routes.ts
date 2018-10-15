import { Routes } from '@angular/router'
import { UserRight } from '../../../../../shared'
import { UserRightGuard } from '@app/core'
import { VideoAbuseListComponent } from '@app/+admin/moderation/video-abuse-list'
import { VideoBlacklistListComponent } from '@app/+admin/moderation/video-blacklist-list'
import { ModerationComponent } from '@app/+admin/moderation/moderation.component'
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from '@app/+admin/moderation/instance-blocklist'

export const ModerationRoutes: Routes = [
  {
    path: 'moderation',
    component: ModerationComponent,
    children: [
      {
        path: '',
        redirectTo: 'video-abuses/list',
        pathMatch: 'full'
      },
      {
        path: 'video-abuses',
        redirectTo: 'video-abuses/list',
        pathMatch: 'full'
      },
      {
        path: 'video-blacklist',
        redirectTo: 'video-blacklist/list',
        pathMatch: 'full'
      },
      {
        path: 'video-abuses/list',
        component: VideoAbuseListComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_VIDEO_ABUSES,
          meta: {
            title: 'Video abuses list'
          }
        }
      },
      {
        path: 'video-blacklist/list',
        component: VideoBlacklistListComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.MANAGE_VIDEO_BLACKLIST,
          meta: {
            title: 'Blacklisted videos'
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
          userRight: UserRight.MANAGE_SERVER_REDUNDANCY,
          meta: {
            title: 'Muted instances'
          }
        }
      }
    ]
  }
]
