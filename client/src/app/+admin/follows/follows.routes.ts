import { Routes } from '@angular/router'
import { VideoRedundanciesListComponent } from '@app/+admin/follows/video-redundancies-list'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'
import { FollowersListComponent } from './followers-list'
import { FollowingListComponent } from './following-list/following-list.component'

export const followsRoutes: Routes = [
  {
    path: 'follows',
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
            title: $localize`Following`
          }
        }
      },
      {
        path: 'followers-list',
        component: FollowersListComponent,
        data: {
          meta: {
            title: $localize`Followers`
          }
        }
      },
      {
        path: 'following-add',
        redirectTo: 'following-list'
      },
      {
        path: 'video-redundancies-list',
        component: VideoRedundanciesListComponent,
        data: {
          meta: {
            title: $localize`Redundancy`
          }
        }
      }
    ]
  }
]
