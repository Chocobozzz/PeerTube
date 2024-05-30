import { filter } from 'rxjs/operators'
import { Component, OnInit } from '@angular/core'
import { AuthService, Notifier, UserService } from '@app/core'
import {
  USER_CONFIRM_PASSWORD_VALIDATOR,
  USER_EXISTING_PASSWORD_VALIDATOR,
  USER_PASSWORD_VALIDATOR
} from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { HttpStatusCode, User } from '@peertube/peertube-models'
import { InputTextComponent } from '../../../shared/shared-forms/input-text.component'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { NgIf } from '@angular/common'

@Component({
  selector: 'my-account-change-password',
  templateUrl: './my-account-change-password.component.html',
  styleUrls: [ './my-account-change-password.component.scss' ],
  standalone: true,
  imports: [ NgIf, FormsModule, ReactiveFormsModule, InputTextComponent ]
})
export class MyAccountChangePasswordComponent extends FormReactive implements OnInit {
  error: string
  user: User

  constructor (
    protected formReactiveService: FormReactiveService,
    private notifier: Notifier,
    private authService: AuthService,
    private userService: UserService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      'current-password': USER_EXISTING_PASSWORD_VALIDATOR,
      'new-password': USER_PASSWORD_VALIDATOR,
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
