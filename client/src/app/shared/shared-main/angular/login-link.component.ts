import { environment } from 'src/environments/environment'
import { Component, Input } from '@angular/core'
import { ServerService } from '@app/core'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { LinkComponent } from './link.component'

@Component({
  selector: 'my-login-link',
  templateUrl: './login-link.component.html',
  standalone: true,
  imports: [ LinkComponent ]
})
export class LoginLinkComponent {
  @Input() label = $localize`Login`

  @Input() className?: string

  constructor (private server: ServerService) {

  }

  getExternalLoginHref () {
    return PluginsManager.getDefaultLoginHref(environment.apiUrl, this.server.getHTMLConfig())
  }
}
