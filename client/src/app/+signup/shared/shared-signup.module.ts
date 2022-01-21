import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedUsersModule } from '@app/shared/shared-users'
import { SignupSuccessComponent } from './signup-success.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedUsersModule
  ],

  declarations: [
    SignupSuccessComponent
  ],

  exports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,

    SignupSuccessComponent
  ],

  providers: [
  ]
})
export class SharedSignupModule { }
