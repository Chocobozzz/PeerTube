import { booleanAttribute, Component, inject, input } from '@angular/core'
import { ServerService } from '@app/core'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { environment } from 'src/environments/environment'
import { LinkComponent } from '../common/link.component'

@Component({
  selector: 'my-login-link',
  templateUrl: './login-link.component.html',
  styleUrls: [ './login-link.component.scss' ],
  imports: [ LinkComponent ]
})
export class LoginLinkComponent {
  private server = inject(ServerService)

  readonly label = input($localize`Login`)
  readonly icon = input(false, { transform: booleanAttribute })

  readonly className = input<string>(undefined)

  getExternalLoginHref () {
    return PluginsManager.getDefaultLoginHref(environment.apiUrl, this.server.getHTMLConfig())
  }
}
