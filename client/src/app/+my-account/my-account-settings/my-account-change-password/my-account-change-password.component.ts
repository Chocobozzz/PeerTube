import { NgIf } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, Notifier, ServerService, UserService } from '@app/core'
import {
  USER_CONFIRM_PASSWORD_VALIDATOR,
  USER_EXISTING_PASSWORD_VALIDATOR,
  getUserPasswordValidator
} from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { HttpStatusCode, User } from '@peertube/peertube-models'
import { filter } from 'rxjs/operators'
import { InputTextComponent } from '../../../shared/shared-forms/input-text.component'

@Component({
  selector: 'my-account-change-password',
  templateUrl: './my-account-change-password.component.html',
  styleUrls: [ './my-account-change-password.component.scss' ],
  imports: [ NgIf, FormsModule, ReactiveFormsModule, InputTextComponent, AlertComponent ]
})
export class MyAccountChangePasswordComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private notifier = inject(Notifier)
  private authService = inject(AuthService)
  private userService = inject(UserService)
  private serverService = inject(ServerService)

  error: string
  user: User
  userPasswordValidator: ReturnType<typeof getUserPasswordValidator>

  ngOnInit () {
    this.serverService.getConfig().subscribe(config => {
      this.userPasswordValidator = getUserPasswordValidator(config.signup.minimum_password_length);
    });
    this.buildForm({
      'current-password': USER_EXISTING_PASSWORD_VALIDATOR,
      'new-password': this.userPasswordValidator,
      'new-confirmed-password': USER_CONFIRM_PASSWORD_VALIDATOR
    })

    this.user = this.authService.getUser()

    const confirmPasswordControl = this.form.get('new-confirmed-password')

    confirmPasswordControl.valueChanges
      .pipe(filter(v => v !== this.form.value['new-password']))
      .subscribe(() => confirmPasswordControl.setErrors({ matchPassword: true }))
  }

  changePassword () {
    const currentPassword = this.form.value['current-password']
    const newPassword = this.form.value['new-password']

    this.userService.changePassword(currentPassword, newPassword)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Password updated.`)

          this.form.reset()
          this.error = null
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
