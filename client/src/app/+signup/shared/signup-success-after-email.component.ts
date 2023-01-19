import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-signup-success-after-email',
  templateUrl: './signup-success-after-email.component.html',
  styleUrls: [ './signup-success.component.scss' ]
})
export class SignupSuccessAfterEmailComponent {
  @Input() requiresApproval: boolean
}
