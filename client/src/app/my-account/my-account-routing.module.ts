import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { LoginGuard } from '../core'
import { MyAccountComponent } from './my-account.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountVideosComponent } from './my-account-videos/my-account-videos.component'

const myAccountRoutes: Routes = [
  {
    path: 'my-account',
    component: MyAccountComponent,
    canActivateChild: [ MetaGuard, LoginGuard ],
    children: [
      {
        path: 'settings',
        component: MyAccountSettingsComponent,
        data: {
          meta: {
            title: 'Account settings'
          }
        }
      },
      {
        path: 'videos',
        component: MyAccountVideosComponent,
        data: {
          meta: {
            title: 'Account videos'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(myAccountRoutes) ],
  exports: [ RouterModule ]
})
export class MyAccountRoutingModule {}
