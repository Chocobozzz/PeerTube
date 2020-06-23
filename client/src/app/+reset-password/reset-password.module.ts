import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedMainModule } from '@app/shared/shared-main'
import { ResetPasswordRoutingModule } from './reset-password-routing.module'
import { ResetPasswordComponent } from './reset-password.component'

@NgModule({
  imports: [
    ResetPasswordRoutingModule,

    SharedMainModule,
    SharedFormModule
  ],

  declarations: [
    ResetPasswordComponent
  ],

  exports: [
    ResetPasswordComponent
  ],

  providers: [
  ]
})
export class ResetPasswordModule { }
