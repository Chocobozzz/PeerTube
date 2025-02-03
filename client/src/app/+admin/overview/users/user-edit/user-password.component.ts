import { Component, Input, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { USER_PASSWORD_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { UserUpdate } from '@peertube/peertube-models'
import { NgClass, NgIf } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'

@Component({
  selector: 'my-user-password',
  templateUrl: './user-password.component.html',
  styleUrls: [ './user-password.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass, NgIf ]
})
export class UserPasswordComponent extends FormReactive implements OnInit {
  @Input() userId: number
  @Input() username: string

  error: string
  showPassword = false

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
