import { Component, Input } from '@angular/core'
import { NgIf } from '@angular/common'
import { SignupStepTitleComponent } from './signup-step-title.component'

@Component({
  selector: 'my-signup-success-before-email',
  templateUrl: './signup-success-before-email.component.html',
  styleUrls: [ './signup-success.component.scss' ],
  standalone: true,
  imports: [ SignupStepTitleComponent, NgIf ]
})
export class SignupSuccessBeforeEmailComponent {
  @Input() requiresApproval: boolean
  @Input() requiresEmailVerification: boolean
  @Input() instanceName: string
}
