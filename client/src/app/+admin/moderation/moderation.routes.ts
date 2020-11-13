import { Routes } from '@angular/router'
import { AbuseListComponent } from '@app/+admin/moderation/abuse-list'
import { InstanceAccountBlocklistComponent, InstanceServerBlocklistComponent } from '@app/+admin/moderation/instance-blocklist'
import { ModerationComponent } from '@app/+admin/moderation/moderation.component'
import { VideoBlockListComponent } from '@app/+admin/moderation/video-block-list'
import { VideoCommentListComponent } from './video-comment-list'
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
        path: 'video-comments',
        redirectTo: 'video-comments/list',
        pathMatch: 'full'
      },
      {
        path: 'video-comments/list',
        component: VideoCommentListComponent,
        canActivate: [ UserRightGuard ],
        data: {
          userRight: UserRight.SEE_ALL_COMMENTS,
          meta: {
            title: $localize`Video comments`
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
      }
    ]
  }
]
