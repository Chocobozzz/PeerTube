import { Routes } from '@angular/router'

import { UserRightGuard } from '../../core'
import { FollowsComponent } from './follows.component'
import { FollowingAddComponent } from './following-add'
import { FollowersListComponent } from './followers-list'
import { UserRight } from '../../../../../shared'
import { FollowingListComponent } from './following-list/following-list.component'

export const FollowsRoutes: Routes = [
  {
    path: 'follows',
    component: FollowsComponent,
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_APPLICATION_FOLLOW
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
        component: FollowingAddComponent,
        data: {
          meta: {
            title: 'Add follow'
          }
        }
      }
    ]
  }
]
