import { Component, Input } from '@angular/core'
import { User, UserRegistration } from '@shared/models/users'

@Component({
  selector: 'my-user-email-info',
  templateUrl: './user-email-info.component.html',
  styleUrls: [ './user-email-info.component.scss' ]
})
export class UserEmailInfoComponent {
  @Input() entry: User | UserRegistration
  @Input() requiresEmailVerification: boolean

  getTitle () {
    if (this.entry.emailVerified) {
      return $localize`User email has been verified`
    }

    return $localize`User email hasn't been verified`
  }
}
