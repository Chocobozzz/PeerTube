import { Component, Input, OnInit } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { FormReactive, FormValidatorService, UserValidatorsService } from '@app/shared/shared-forms'
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
    protected formValidatorService: FormValidatorService,
    private userValidatorsService: UserValidatorsService,
    private notifier: Notifier,
    private userService: UserService
    ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      password: this.userValidatorsService.USER_PASSWORD
    })
  }

  formValidated () {
    this.error = undefined

    const userUpdate: UserUpdate = this.form.value

    this.userService.updateUser(this.userId, userUpdate).subscribe(
      () => {
        this.notifier.success($localize`Password changed for user ${this.username}.`)
      },

      err => this.error = err.message
    )
  }

  togglePasswordVisibility () {
    this.showPassword = !this.showPassword
  }

  getFormButtonTitle () {
    return $localize`Update user password`
  }
}
