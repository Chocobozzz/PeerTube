import { NgModule } from '@angular/core'

import { AccountRoutingModule } from './account-routing.module'
import { AccountComponent } from './account.component'
import { AccountChangePasswordComponent } from './account-change-password'
import { AccountDetailsComponent } from './account-details'
import { AccountService } from './account.service'
import { SharedModule } from '../shared'

@NgModule({
  imports: [
    AccountRoutingModule,
    SharedModule
  ],

  declarations: [
    AccountComponent,
    AccountChangePasswordComponent,
    AccountDetailsComponent
  ],

  exports: [
    AccountComponent
  ],

  providers: []
})
export class AccountModule { }
