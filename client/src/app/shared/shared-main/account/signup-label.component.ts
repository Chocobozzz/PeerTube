import { Component, Input } from '@angular/core'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-signup-label',
  templateUrl: './signup-label.component.html',
  standalone: true,
  imports: [ NgIf ]
})
export class SignupLabelComponent {
  @Input() requiresApproval: boolean
}
