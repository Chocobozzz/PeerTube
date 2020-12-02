import { CdkStepperModule } from '@angular/cdk/stepper'
import { NgModule } from '@angular/core'
import { SignupSharedModule } from '@app/+signup/shared/signup-shared.module'
import { SharedInstanceModule } from '@app/shared/shared-instance'
import { CustomStepperComponent } from './custom-stepper.component'
import { RegisterRoutingModule } from './register-routing.module'
import { RegisterStepChannelComponent } from './register-step-channel.component'
import { RegisterStepTermsComponent } from './register-step-terms.component'
import { RegisterStepUserComponent } from './register-step-user.component'
import { RegisterComponent } from './register.component'

@NgModule({
  imports: [
    RegisterRoutingModule,

    CdkStepperModule,

    SignupSharedModule,

    SharedInstanceModule
  ],

  declarations: [
    RegisterComponent,
    CustomStepperComponent,
    RegisterStepChannelComponent,
    RegisterStepTermsComponent,
    RegisterStepUserComponent
  ],

  exports: [
    RegisterComponent
  ],

  providers: [
  ]
})
export class RegisterModule { }
