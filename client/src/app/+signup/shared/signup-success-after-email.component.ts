import { Component, input, ChangeDetectionStrategy } from '@angular/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { SignupStepTitleComponent } from './signup-step-title.component'

@Component({
  selector: 'my-signup-success-after-email',
  templateUrl: './signup-success-after-email.component.html',
  styleUrls: [ './signup-success.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ SignupStepTitleComponent, AlertComponent ]
})
export class SignupSuccessAfterEmailComponent {
  readonly requiresApproval = input<boolean>(undefined)
}
