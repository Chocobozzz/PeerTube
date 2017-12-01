import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginGuard } from '../core'
import { AccountComponent } from './account.component'
import { AccountSettingsComponent } from './account-settings/account-settings.component'
import { AccountVideosComponent } from './account-videos/account-videos.component'

const accountRoutes: Routes = [
  {
    path: 'account',
    component: AccountComponent,
    canActivateChild: [ MetaGuard, LoginGuard ],
    children: [
      {
        path: 'settings',
        component: AccountSettingsComponent,
        data: {
          meta: {
            title: 'Account settings'
          }
        }
      },
      {
        path: 'videos',
        component: AccountVideosComponent,
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
  imports: [ RouterModule.forChild(accountRoutes) ],
  exports: [ RouterModule ]
})
export class AccountRoutingModule {}
