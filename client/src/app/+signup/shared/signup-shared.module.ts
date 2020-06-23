import { NgModule } from '@angular/core'
import { SharedMainModule } from '@app/shared/shared-main'
import { SignupSuccessComponent } from './signup-success.component'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule
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
export class SignupSharedModule { }
