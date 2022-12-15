import { Component, Input, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { USER_PASSWORD_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive, FormReactiveService } from '@app/shared/shared-forms'
import { UserAdminService } from '@app/shared/shared-users'
import { UserUpdate } from '@shared/models'

@Component({
  selector: 'my-user-password',
  templateUrl: './user-password.component.html',
  styleUrls: [ './user-password.component.scss' ]
})
export class UserPasswordComponent extends FormReactive implements OnInit {
  error: string
  username: string
  showPassword = false

  @Input() userId: number

  constructor (
    protected formReactiveService: FormReactiveService,
    private notifier: Notifier,
    private userAdminService: UserAdminService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      password: USER_PASSWORD_VALIDATOR
    })
  }

  formValidated () {
    this.error = undefined

    const userUpdate: UserUpdate = this.form.value

    this.userAdminService.updateUser(this.userId, userUpdate)
      .subscribe({
        next: () => this.notifier.success($localize`Password changed for user ${this.username}.`),

        error: err => {
          this.error = err.message
        }
      })
  }

  togglePasswordVisibility () {
    this.showPassword = !this.showPassword
  }

  getFormButtonTitle () {
    return $localize`Update user password`
  }
}
