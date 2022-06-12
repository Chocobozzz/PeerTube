import { Routes } from '@angular/router'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@shared/models'
import { VideoListComponent } from './video-list.component'

export const VideosRoutes: Routes = [
  {
    path: 'videos',
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.SEE_ALL_VIDEOS
    },
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: VideoListComponent,
        data: {
          meta: {
            title: $localize`Videos list`
          }
        }
      }
    ]
  }
]
