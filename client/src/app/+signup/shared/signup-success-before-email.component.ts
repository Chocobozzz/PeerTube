import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-signup-success-before-email',
  templateUrl: './signup-success-before-email.component.html',
  styleUrls: [ './signup-success.component.scss' ]
})
export class SignupSuccessBeforeEmailComponent {
  @Input() requiresApproval: boolean
  @Input() requiresEmailVerification: boolean
  @Input() instanceName: string
}
