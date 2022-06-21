import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedUsersModule } from '@app/shared/shared-users'
import { SignupMascotComponent } from './signup-mascot.component'
import { SignupStepTitleComponent } from './signup-step-title.component'
import { SignupSuccessComponent } from './signup-success.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedUsersModule
  ],

  declarations: [
    SignupSuccessComponent,
    SignupStepTitleComponent,
    SignupMascotComponent
  ],

  exports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,

    SignupSuccessComponent,
    SignupStepTitleComponent,
    SignupMascotComponent
  ],

  providers: [
  ]
})
export class SharedSignupModule { }
