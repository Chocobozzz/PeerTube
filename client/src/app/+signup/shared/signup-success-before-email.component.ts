import { Component, input } from '@angular/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { SignupStepTitleComponent } from './signup-step-title.component'

@Component({
  selector: 'my-signup-success-before-email',
  templateUrl: './signup-success-before-email.component.html',
  styleUrls: [ './signup-success.component.scss' ],
  imports: [ SignupStepTitleComponent, AlertComponent ]
})
export class SignupSuccessBeforeEmailComponent {
  readonly requiresApproval = input<boolean>(undefined)
  readonly requiresEmailVerification = input<boolean>(undefined)
  readonly instanceName = input<string>(undefined)
}
