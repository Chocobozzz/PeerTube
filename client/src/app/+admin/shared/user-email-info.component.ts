import { Component, Input, booleanAttribute } from '@angular/core'
import { User, UserRegistration } from '@peertube/peertube-models'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-user-email-info',
  templateUrl: './user-email-info.component.html',
  styleUrls: [ './user-email-info.component.scss' ],
  imports: [ NgIf ]
})
export class UserEmailInfoComponent {
  @Input() entry: User | UserRegistration
  @Input({ transform: booleanAttribute }) showEmailVerifyInformation: boolean

  getTitle () {
    if (this.entry.emailVerified) {
      return $localize`User email has been verified`
    }

    return $localize`User email hasn't been verified`
  }
}
