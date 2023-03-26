import { Component, Input } from '@angular/core'
import { ServerService } from '@app/core'

@Component({
  selector: 'my-register-step-about',
  templateUrl: './register-step-about.component.html',
  styleUrls: [ './register-step-about.component.scss' ]
})
export class RegisterStepAboutComponent {
  @Input() requiresApproval: boolean
  @Input() videoUploadDisabled: boolean

  constructor (private serverService: ServerService) {

  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }
}
