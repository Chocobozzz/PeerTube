import { Routes } from '@angular/router'
import { UserRight } from '../../../../../shared'
import { UserRightGuard } from '@app/core'
import { VideoAbuseListComponent } from '@app/+admin/moderation/video-abuse-list'
import { VideoBlacklistListComponent } from '@app/+admin/moderation/video-blacklist-list'
import { ModerationComponent } from '@app/+admin/moderation/moderation.component'

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
      }
    ]
  }
]
