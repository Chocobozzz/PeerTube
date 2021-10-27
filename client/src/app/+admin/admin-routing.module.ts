import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { ConfigRoutes } from '@app/+admin/config'
import { ModerationRoutes } from '@app/+admin/moderation/moderation.routes'
import { PluginsRoutes } from '@app/+admin/plugins/plugins.routes'
import { SystemRoutes } from '@app/+admin/system'
import { AdminComponent } from './admin.component'
import { FollowsRoutes } from './follows'
import { OverviewRoutes } from './overview'

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

      ...FollowsRoutes,
      ...OverviewRoutes,
      ...ModerationRoutes,
      ...SystemRoutes,
      ...ConfigRoutes,
      ...PluginsRoutes
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(adminRoutes) ],
  exports: [ RouterModule ]
})
export class AdminRoutingModule {}
