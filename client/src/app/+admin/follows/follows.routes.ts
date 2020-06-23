import { Routes } from '@angular/router'
import { VideoRedundanciesListComponent } from '@app/+admin/follows/video-redundancies-list'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@shared/models'
import { FollowersListComponent } from './followers-list'
import { FollowingListComponent } from './following-list/following-list.component'
import { FollowsComponent } from './follows.component'

export const FollowsRoutes: Routes = [
  {
    path: 'follows',
    component: FollowsComponent,
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_SERVER_FOLLOW
    },
    children: [
      {
        path: '',
        redirectTo: 'following-list',
        pathMatch: 'full'
      },
      {
        path: 'following-list',
        component: FollowingListComponent,
        data: {
          meta: {
            title: 'Following list'
          }
        }
      },
      {
        path: 'followers-list',
        component: FollowersListComponent,
        data: {
          meta: {
            title: 'Followers list'
          }
        }
      },
      {
        path: 'following-add',
        redirectTo: 'following-list'
      },
      {
        path: 'video-redundancies-list',
        component: VideoRedundanciesListComponent
      }
    ]
  }
]
