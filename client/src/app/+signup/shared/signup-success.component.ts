import { Component, Input } from '@angular/core'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-signup-success',
  templateUrl: './signup-success.component.html',
  styleUrls: [ './signup-success.component.scss' ]
})
export class SignupSuccessComponent {
  @Input() requiresEmailVerification: boolean

  constructor (private serverService: ServerService) {

  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }
}
