import { booleanAttribute, Component, Input } from '@angular/core'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-signup-label',
  templateUrl: './signup-label.component.html',
  standalone: true,
  imports: []
})
export class SignupLabelComponent {
  @Input({ transform: booleanAttribute }) requiresApproval: boolean
  @Input({ transform: booleanAttribute }) withInstanceName = false

  constructor (private server: ServerService) {
  }

  get instanceName () {
    return this.server.getHTMLConfig().instance.name
  }
}
