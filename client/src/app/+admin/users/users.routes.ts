import { Routes } from '@angular/router';

import { UsersComponent } from './users.component';
import { UserAddComponent } from './user-add';
import { UserListComponent } from './user-list';

export const UsersRoutes: Routes = [
  {
    path: 'users',
    component: UsersComponent,
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
            title: 'Users list'
          }
        }
      },
      {
        path: 'add',
        component: UserAddComponent,
        data: {
          meta: {
            title: 'Add a user'
          }
        }
      }
    ]
  }
];
