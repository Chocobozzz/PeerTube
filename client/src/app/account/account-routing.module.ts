import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { LoginGuard } from '../core'
import { AccountComponent } from './account.component'

const accountRoutes: Routes = [
  {
    path: 'account',
    component: AccountComponent,
    canActivate: [ MetaGuard, LoginGuard ],
    data: {
      meta: {
        title: 'My account'
      }
    }
  }
]

@NgModule({
  imports: [ RouterModule.forChild(accountRoutes) ],
  exports: [ RouterModule ]
})
export class AccountRoutingModule {}
