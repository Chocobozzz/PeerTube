import { Component, OnInit, inject } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { Notifier, ServerService, UserService } from '@app/core'
import { RESET_PASSWORD_CONFIRM_VALIDATOR } from '@app/shared/form-validators/reset-password-validators'
import { getUserNewPasswordValidator } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { InputTextComponent } from '../shared/shared-forms/input-text.component'

@Component({
  templateUrl: './reset-password.component.html',
  styleUrls: [ './reset-password.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, InputTextComponent ]
})
export class ResetPasswordComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private userService = inject(UserService)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)
  private router = inject(Router)
  private route = inject(ActivatedRoute)

  private userId: number
  private verificationString: string

  ngOnInit () {
    const { minLength, maxLength } = this.serverService.getHTMLConfig().fieldsConstraints.users.password

    this.buildForm({
      'password': getUserNewPasswordValidator(minLength, maxLength),
      'password-confirm': RESET_PASSWORD_CONFIRM_VALIDATOR
    })

    this.userId = this.route.snapshot.queryParams['userId']
    this.verificationString = this.route.snapshot.queryParams['verificationString']

    if (!this.userId || !this.verificationString) {
      this.notifier.error($localize`Unable to find user id or verification string.`)
      this.router.navigate([ '/' ])
    }
  }

  resetPassword () {
    this.userService.resetPassword(this.userId, this.verificationString, this.form.value.password)
      .subscribe({
        next: () => {
          this.notifier.success($localize`Your password has been successfully reset!`)

          this.router.navigate([ '/login' ])
        },

        error: err => this.notifier.handleError(err)
      })
  }

  isConfirmedPasswordValid () {
    const values = this.form.value
    return values.password === values['password-confirm']
  }
}
