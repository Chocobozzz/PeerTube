import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AccountComponent } from './account.component';

const accountRoutes: Routes = [
  {
    path: 'account',
    component: AccountComponent,
    data: {
      meta: {
        title: 'My account'
      }
    }
  }
];

@NgModule({
  imports: [ RouterModule.forChild(accountRoutes) ],
  exports: [ RouterModule ]
})
export class AccountRoutingModule {}
