import { Routes } from '@angular/router'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'
import { UserCreateComponent, UserUpdateComponent } from './user-edit'
import { UserListComponent } from './user-list'

export const usersRoutes: Routes = [
  {
    path: 'users',
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_USERS
    },
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: UserListComponent,
        data: {
          meta: {
            title: $localize`Users list`
          }
        }
      },
      {
        path: 'create',
        component: UserCreateComponent,
        data: {
          meta: {
            title: $localize`Create a user`
          }
        }
      },
      {
        path: 'update/:id',
        component: UserUpdateComponent,
        data: {
          meta: {
            title: $localize`Update a user`
          }
        }
      }
    ]
  }
]
