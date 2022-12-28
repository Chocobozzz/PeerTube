import { forkJoin } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { AuthService, ServerService, UserService } from '@app/core'
import { USER_EMAIL_VALIDATOR, USER_PASSWORD_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { HttpStatusCode, User, UserUpdateMe } from '@shared/models'

@Component({
  selector: 'my-account-change-email',
  templateUrl: './my-account-change-email.component.html',
  styleUrls: [ './my-account-change-email.component.scss' ]
})
export class MyAccountChangeEmailComponent extends FormReactive implements OnInit {
  error: string = null
  success: string = null
  user: User = null

  emailPreferences = { 'isEmailPublic': false }

  constructor (
    protected formReactiveService: FormReactiveService,
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'new-email': USER_EMAIL_VALIDATOR,
      password: USER_PASSWORD_VALIDATOR
    })

    this.user = this.authService.getUser()
    this.emailPreferences['isEmailPublic'] = this.user.isEmailPublic
  }

  updateIsEmailPublic () {
    console.log("model changed")
    const details: UserUpdateMe = {
      isEmailPublic: this.emailPreferences['isEmailPublic']
    }

    this.userService.updateMyProfile(details)
      .subscribe({
        next: () => {
          this.authService.refreshUserInformation()
        },

        error: err => console.log(err.message)
      })
  }

  changeEmail () {
    this.error = null
    this.success = null

    const password = this.form.value['password']
    const email = this.form.value['new-email']

    forkJoin([
      this.serverService.getConfig(),
      this.userService.changeEmail(password, email)
    ]).pipe(tap(() => this.authService.refreshUserInformation()))
      .subscribe({
        next: ([ config ]) => {
          this.form.reset()

          if (config.signup.requiresEmailVerification) {
            this.success = $localize`Please check your emails to verify your new email.`
          } else {
            this.success = $localize`Email updated.`
          }
        },

        error: err => {
          if (err.status === HttpStatusCode.UNAUTHORIZED_401) {
            this.error = $localize`You current password is invalid.`
            return
          }

          this.error = err.message
        }
      })
  }
}
