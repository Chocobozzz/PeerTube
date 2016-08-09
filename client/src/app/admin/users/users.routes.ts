import { RouterConfig } from '@angular/router';

import { UsersComponent } from './users.component';
import { UserAddComponent } from './user-add';
import { UserListComponent } from './user-list';

export const UsersRoutes: RouterConfig = [
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
          component: UserListComponent
        },
        {
          path: 'add',
          component: UserAddComponent
        }
      ]
    }
];
