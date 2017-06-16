import { Routes } from '@angular/router'

import { VideoAbusesComponent } from './video-abuses.component'
import { VideoAbuseListComponent } from './video-abuse-list'

export const VideoAbusesRoutes: Routes = [
  {
    path: 'video-abuses',
    component: VideoAbusesComponent
    ,
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
