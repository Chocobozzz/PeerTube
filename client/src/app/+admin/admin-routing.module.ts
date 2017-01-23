import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminComponent } from './admin.component';
import { FriendsRoutes } from './friends';
import { RequestsRoutes } from './requests';
import { UsersRoutes } from './users';
import { VideoAbusesRoutes } from './video-abuses';

const adminRoutes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      ...FriendsRoutes,
      ...RequestsRoutes,
      ...UsersRoutes,
      ...VideoAbusesRoutes
    ]
  }
];

@NgModule({
  imports: [ RouterModule.forChild(adminRoutes) ],
  exports: [ RouterModule ]
})
export class AdminRoutingModule {}
