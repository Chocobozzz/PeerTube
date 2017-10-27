import { Routes } from '@angular/router'

import { UserRightGuard } from '../../core'
import { UserRight } from '../../../../../shared'
import { VideoBlacklistComponent } from './video-blacklist.component'
import { VideoBlacklistListComponent } from './video-blacklist-list'

export const VideoBlacklistRoutes: Routes = [
  {
    path: 'video-blacklist',
    component: VideoBlacklistComponent,
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_VIDEO_BLACKLIST
    },
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: VideoBlacklistListComponent,
        data: {
          meta: {
            title: 'Blacklisted videos'
          }
        }
      }
    ]
  }
]
