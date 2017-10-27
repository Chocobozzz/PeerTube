import { Routes } from '@angular/router'

import { UserRightGuard } from '../../core'
import { UserRight } from '../../../../../shared'
import { VideoAbusesComponent } from './video-abuses.component'
import { VideoAbuseListComponent } from './video-abuse-list'

export const VideoAbusesRoutes: Routes = [
  {
    path: 'video-abuses',
    component: VideoAbusesComponent,
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_VIDEO_ABUSES
    },
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: VideoAbuseListComponent,
        data: {
          meta: {
            title: 'Video abuses list'
          }
        }
      }
    ]
  }
]
