import { booleanAttribute, Component, Input } from '@angular/core'
import { ServerService } from '@app/core'
import { PluginsManager } from '@root-helpers/plugins-manager'
import { environment } from 'src/environments/environment'
import { LinkComponent } from '../common/link.component'

@Component({
  selector: 'my-login-link',
  templateUrl: './login-link.component.html',
  styleUrls: [ './login-link.component.scss' ],
  standalone: true,
  imports: [ LinkComponent ]
})
export class LoginLinkComponent {
  @Input() label = $localize`Login`
  @Input({ transform: booleanAttribute }) icon = false

  @Input() className?: string

  constructor (private server: ServerService) {

  }

  getExternalLoginHref () {
    return PluginsManager.getDefaultLoginHref(environment.apiUrl, this.server.getHTMLConfig())
  }
}
