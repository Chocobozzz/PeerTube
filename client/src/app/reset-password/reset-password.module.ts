import { NgModule } from '@angular/core'

import { ResetPasswordRoutingModule } from './reset-password-routing.module'
import { ResetPasswordComponent } from './reset-password.component'
import { SharedModule } from '../shared'

@NgModule({
  imports: [
    ResetPasswordRoutingModule,
    SharedModule
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
