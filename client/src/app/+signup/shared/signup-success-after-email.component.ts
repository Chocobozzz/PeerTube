import { Component, Input } from '@angular/core'
import { NgIf } from '@angular/common'
import { SignupStepTitleComponent } from './signup-step-title.component'

@Component({
  selector: 'my-signup-success-after-email',
  templateUrl: './signup-success-after-email.component.html',
  styleUrls: [ './signup-success.component.scss' ],
  standalone: true,
  imports: [ SignupStepTitleComponent, NgIf ]
})
export class SignupSuccessAfterEmailComponent {
  @Input() requiresApproval: boolean
}
