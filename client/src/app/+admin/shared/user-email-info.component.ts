import { Component, booleanAttribute, input } from '@angular/core'
import { User, UserRegistration } from '@peertube/peertube-models'

@Component({
  selector: 'my-user-email-info',
  templateUrl: './user-email-info.component.html',
  styleUrls: [ './user-email-info.component.scss' ],
  imports: []
})
export class UserEmailInfoComponent {
  readonly entry = input<User | UserRegistration>(undefined)
  readonly showEmailVerifyInformation = input<boolean, unknown>(undefined, { transform: booleanAttribute })

  getTitle () {
    if (this.entry().emailVerified) {
      return $localize`User email has been verified`
    }

    return $localize`User email hasn't been verified`
  }
}
