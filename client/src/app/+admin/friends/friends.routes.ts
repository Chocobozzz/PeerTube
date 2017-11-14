import { Routes } from '@angular/router'

import { UserRightGuard } from '../../core'
import { FriendsComponent } from './friends.component'
import { FriendAddComponent } from './friend-add'
import { FriendListComponent } from './friend-list'
import { UserRight } from '../../../../../shared'

export const FriendsRoutes: Routes = [
  {
    path: 'friends',
    component: FriendsComponent,
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_PEERTUBE_FOLLOW
    },
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: FriendListComponent,
        data: {
          meta: {
            title: 'Friends list'
          }
        }
      },
      {
        path: 'add',
        component: FriendAddComponent,
        data: {
          meta: {
            title: 'Add friends'
          }
        }
      }
    ]
  }
]
