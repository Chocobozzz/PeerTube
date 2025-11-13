import { CommonModule, NgClass } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, ServerService, UserService } from '@app/core'
import { LOGIN_PASSWORD_VALIDATOR } from '@app/shared/form-validators/login-validators'
import { USER_EMAIL_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { HttpStatusCode, User } from '@peertube/peertube-models'
import { forkJoin } from 'rxjs'
import { tap } from 'rxjs/operators'
import { InputTextComponent } from '../../../shared/shared-forms/input-text.component'

@Component({
  selector: 'my-account-change-email',
  templateUrl: './my-account-change-email.component.html',
  styleUrls: [ './my-account-change-email.component.scss' ],
  imports: [ CommonModule, FormsModule, ReactiveFormsModule, NgClass, InputTextComponent, AlertComponent ]
})
export class MyAccountChangeEmailComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private authService = inject(AuthService)
  private userService = inject(UserService)
  private serverService = inject(ServerService)

  verificationEmailSent = false
  error: string
  success: string
  user: User

  ngOnInit () {
    this.buildForm({
      'new-email': USER_EMAIL_VALIDATOR,
      'password': LOGIN_PASSWORD_VALIDATOR
    })

    this.user = this.authService.getUser()
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

  resendVerificationEmail () {
    this.userService.askSendVerifyEmail(this.user.pendingEmail).subscribe({
      next: () => {
        this.verificationEmailSent = true
      },

      error: err => {
        this.error = err.message
      }
    })
  }
}
