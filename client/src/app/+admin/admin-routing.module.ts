import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { ConfigRoutes } from '@app/+admin/config'

import { MetaGuard } from '@ngx-meta/core'

import { AdminComponent } from './admin.component'
import { FollowsRoutes } from './follows'
import { JobsRoutes } from './jobs/job.routes'
import { UsersRoutes } from './users'
import { VideoAbusesRoutes } from './video-abuses'
import { VideoBlacklistRoutes } from './video-blacklist'

const adminRoutes: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [ MetaGuard ],
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      ...FollowsRoutes,
      ...UsersRoutes,
      ...VideoAbusesRoutes,
      ...VideoBlacklistRoutes,
      ...JobsRoutes,
      ...ConfigRoutes
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(adminRoutes) ],
  exports: [ RouterModule ]
})
export class AdminRoutingModule {}
