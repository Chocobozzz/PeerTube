import { forkJoin } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { AuthService, ServerService, UserService } from '@app/core'
import { FormReactive, FormValidatorService, UserValidatorsService } from '@app/shared/shared-forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { User } from '@shared/models'

@Component({
  selector: 'my-account-change-email',
  templateUrl: './my-account-change-email.component.html',
  styleUrls: [ './my-account-change-email.component.scss' ]
})
export class MyAccountChangeEmailComponent extends FormReactive implements OnInit {
  error: string = null
  success: string = null
  user: User = null

  constructor (
    protected formValidatorService: FormValidatorService,
    private userValidatorsService: UserValidatorsService,
    private authService: AuthService,
    private userService: UserService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'new-email': this.userValidatorsService.USER_EMAIL,
      'password': this.userValidatorsService.USER_PASSWORD
    })

    this.user = this.authService.getUser()
  }

  changeEmail () {
    this.error = null
    this.success = null

    const password = this.form.value[ 'password' ]
    const email = this.form.value[ 'new-email' ]

    forkJoin([
      this.serverService.getConfig(),
      this.userService.changeEmail(password, email)
    ]).pipe(tap(() => this.authService.refreshUserInformation()))
      .subscribe(
        ([ config ]) => {
          this.form.reset()

          if (config.signup.requiresEmailVerification) {
            this.success = this.i18n('Please check your emails to verify your new email.')
          } else {
            this.success = this.i18n('Email updated.')
          }
        },

        err => {
          if (err.status === 401) {
            this.error = this.i18n('You current password is invalid.')
            return
          }

          this.error = err.message
        }
      )
  }
}
