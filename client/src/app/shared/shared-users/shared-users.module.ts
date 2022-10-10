
import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { TwoFactorService } from './two-factor.service'
import { UserAdminService } from './user-admin.service'
import { UserSignupService } from './user-signup.service'

@NgModule({
  imports: [
    SharedMainModule
  ],

  declarations: [ ],

  exports: [],

  providers: [
    UserSignupService,
    UserAdminService,
    TwoFactorService
  ]
})
export class SharedUsersModule { }
