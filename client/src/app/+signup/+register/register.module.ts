import { NgModule } from '@angular/core'
import { RegisterRoutingModule } from './register-routing.module'
import { RegisterComponent } from './register.component'
import { SharedModule } from '@app/shared'
import { CdkStepperModule } from '@angular/cdk/stepper'
import { RegisterStepChannelComponent } from './register-step-channel.component'
import { RegisterStepUserComponent } from './register-step-user.component'
import { CustomStepperComponent } from './custom-stepper.component'
import { SignupSharedModule } from '@app/+signup/shared/signup-shared.module'
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap'

@NgModule({
  imports: [
    RegisterRoutingModule,
    SharedModule,
    CdkStepperModule,
    SignupSharedModule,
    NgbAccordionModule
  ],

  declarations: [
    RegisterComponent,
    CustomStepperComponent,
    RegisterStepChannelComponent,
    RegisterStepUserComponent
  ],

  exports: [
    RegisterComponent
  ],

  providers: [
  ]
})
export class RegisterModule { }
