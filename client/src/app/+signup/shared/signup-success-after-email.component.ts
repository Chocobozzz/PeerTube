import { NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { SignupStepTitleComponent } from './signup-step-title.component'

@Component({
  selector: 'my-signup-success-after-email',
  templateUrl: './signup-success-after-email.component.html',
  styleUrls: [ './signup-success.component.scss' ],
  imports: [ SignupStepTitleComponent, NgIf, AlertComponent ]
})
export class SignupSuccessAfterEmailComponent {
  @Input() requiresApproval: boolean
}
