
import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main/shared-main.module'
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
    UserAdminService
  ]
})
export class SharedUsersModule { }
