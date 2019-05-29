import { NgModule } from '@angular/core'
import { SignupRoutingModule } from './signup-routing.module'
import { SignupComponent } from './signup.component'
import { SharedModule } from '../shared'
import { CdkStepperModule } from '@angular/cdk/stepper'
import { SignupStepChannelComponent } from '@app/signup/signup-step-channel.component'
import { SignupStepUserComponent } from '@app/signup/signup-step-user.component'
import { CustomStepperComponent } from '@app/signup/custom-stepper.component'
import { SuccessComponent } from '@app/signup/success.component'

@NgModule({
  imports: [
    SignupRoutingModule,
    SharedModule,
    CdkStepperModule
  ],

  declarations: [
    SignupComponent,
    CustomStepperComponent,
    SuccessComponent,
    SignupStepChannelComponent,
    SignupStepUserComponent
  ],

  exports: [
    SignupComponent
  ],

  providers: [
  ]
})
export class SignupModule { }
