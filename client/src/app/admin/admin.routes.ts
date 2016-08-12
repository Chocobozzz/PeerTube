import { RouterConfig } from '@angular/router';

import { AdminComponent } from './admin.component';
import { FriendsRoutes } from './friends';
import { UsersRoutes } from './users';

export const AdminRoutes: RouterConfig = [
  {
    path: 'admin',
    component: AdminComponent,
    children: [
      ...FriendsRoutes,
      ...UsersRoutes
    ]
  }
];
