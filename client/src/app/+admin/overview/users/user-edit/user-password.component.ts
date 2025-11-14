import { NgClass } from '@angular/common'
import { Component, OnInit, inject, input } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier, ServerService } from '@app/core'
import { getUserNewPasswordValidator } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { UserUpdate } from '@peertube/peertube-models'

@Component({
  selector: 'my-user-password',
  templateUrl: './user-password.component.html',
  styleUrls: [ './user-password.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass ]
})
export class UserPasswordComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private notifier = inject(Notifier)
  private userAdminService = inject(UserAdminService)
  private serverService = inject(ServerService)

  readonly userId = input<number>(undefined)
  readonly username = input<string>(undefined)

  error: string
  showPassword = false

  ngOnInit () {
    const { minLength, maxLength } = this.serverService.getHTMLConfig().fieldsConstraints.users.password

    this.buildForm({ password: getUserNewPasswordValidator(minLength, maxLength) })
  }

  formValidated () {
    this.error = undefined

    const userUpdate: UserUpdate = this.form.value

    this.userAdminService.updateUser(this.userId(), userUpdate)
      .subscribe({
        next: () => this.notifier.success($localize`Password changed for user ${this.username()}.`),

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
