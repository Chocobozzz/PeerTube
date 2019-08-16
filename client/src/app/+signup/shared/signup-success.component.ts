import { Component, Input } from '@angular/core'

@Component({
  selector: 'my-signup-success',
  templateUrl: './signup-success.component.html',
  styleUrls: [ './signup-success.component.scss' ]
})
export class SignupSuccessComponent {
  @Input() message: string
}
