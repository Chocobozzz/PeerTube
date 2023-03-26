import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-signup-label',
  templateUrl: './signup-label.component.html'
})
export class SignupLabelComponent {
  @Input() requiresApproval: boolean
}
