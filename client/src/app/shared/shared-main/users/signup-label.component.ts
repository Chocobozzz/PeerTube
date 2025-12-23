import { booleanAttribute, Component, inject, input } from '@angular/core'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-signup-label',
  templateUrl: './signup-label.component.html',
  imports: []
})
export class SignupLabelComponent {
  private server = inject(ServerService)

  readonly requiresApproval = input<boolean, unknown>(undefined, { transform: booleanAttribute })
  readonly withInstanceName = input(false, { transform: booleanAttribute })

  get instanceName () {
    return this.server.getHTMLConfig().instance.name
  }
}
