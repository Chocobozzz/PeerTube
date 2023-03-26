import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedGlobalIconModule } from '@app/shared/shared-icons'
import { SharedMainModule } from '@app/shared/shared-main'
import { SharedUsersModule } from '@app/shared/shared-users'
import { SignupMascotComponent } from './signup-mascot.component'
import { SignupStepTitleComponent } from './signup-step-title.component'
import { SignupSuccessBeforeEmailComponent } from './signup-success-before-email.component'
import { SignupSuccessAfterEmailComponent } from './signup-success-after-email.component'
import { SignupService } from './signup.service'

@NgModule({
  imports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,
    SharedUsersModule
  ],

  declarations: [
    SignupSuccessBeforeEmailComponent,
    SignupSuccessAfterEmailComponent,
    SignupStepTitleComponent,
    SignupMascotComponent
  ],

  exports: [
    SharedMainModule,
    SharedFormModule,
    SharedGlobalIconModule,

    SignupSuccessBeforeEmailComponent,
    SignupSuccessAfterEmailComponent,
    SignupStepTitleComponent,
    SignupMascotComponent
  ],

  providers: [
    SignupService
  ]
})
export class SharedSignupModule { }
