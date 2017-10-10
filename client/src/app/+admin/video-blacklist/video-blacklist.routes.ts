import { Routes } from '@angular/router'

import { VideoBlacklistComponent } from './video-blacklist.component'
import { VideoBlacklistListComponent } from './video-blacklist-list'

export const VideoBlacklistRoutes: Routes = [
  {
    path: 'video-blacklist',
    component: VideoBlacklistComponent,
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
