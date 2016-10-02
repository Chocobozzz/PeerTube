import { Routes } from '@angular/router';

import { AdminComponent } from './admin.component';
import { FriendsRoutes } from './friends';
import { RequestsRoutes } from './requests';
import { UsersRoutes } from './users';

export const AdminRoutes: Routes = [
  {
    path: 'admin',
    component: AdminComponent,
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      ...FriendsRoutes,
      ...RequestsRoutes,
      ...UsersRoutes
    ]
  }
];
