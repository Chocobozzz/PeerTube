import { NgModule } from '@angular/core'
import { SignupSuccessComponent } from '../shared/signup-success.component'
import { SharedModule } from '@app/shared'

@NgModule({
  imports: [
    SharedModule
  ],

  declarations: [
    SignupSuccessComponent
  ],

  exports: [
    SignupSuccessComponent
  ],

  providers: [
  ]
})
export class SignupSharedModule { }
