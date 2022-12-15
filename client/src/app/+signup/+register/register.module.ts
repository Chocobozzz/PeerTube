import { CdkStepperModule } from '@angular/cdk/stepper'
import { NgModule } from '@angular/core'
import { SharedSignupModule } from '@app/+signup/shared/shared-signup.module'
import { SharedInstanceModule } from '@app/shared/shared-instance'
import { SharedMainModule } from '@app/shared/shared-main'
import { CustomStepperComponent } from './custom-stepper.component'
import { RegisterRoutingModule } from './register-routing.module'
import { RegisterComponent } from './register.component'
import { RegisterStepAboutComponent, RegisterStepChannelComponent, RegisterStepTermsComponent, RegisterStepUserComponent } from './steps'

@NgModule({
  imports: [
    SharedMainModule,
    RegisterRoutingModule,

    CdkStepperModule,

    SharedSignupModule,

    SharedInstanceModule
  ],

  declarations: [
    RegisterComponent,
    CustomStepperComponent,
    RegisterStepChannelComponent,
    RegisterStepTermsComponent,
    RegisterStepUserComponent,
    RegisterStepAboutComponent
  ],

  exports: [
    RegisterComponent
  ],

  providers: [
  ]
})
export class RegisterModule { }
