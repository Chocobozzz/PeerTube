import { Component, OnInit } from '@angular/core'
import { Notifier, RedirectService, ServerService, UserService } from '@app/core'
import { USER_EMAIL_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'

@Component({
  selector: 'my-verify-account-ask-send-email',
  templateUrl: './verify-account-ask-send-email.component.html',
  styleUrls: [ './verify-account-ask-send-email.component.scss' ]
})

export class VerifyAccountAskSendEmailComponent extends FormReactive implements OnInit {
  requiresEmailVerification = false

  constructor (
    protected formValidatorService: FormValidatorService,
    private userService: UserService,
    private serverService: ServerService,
    private notifier: Notifier,
    private redirectService: RedirectService
  ) {
    super()
  }

  ngOnInit () {
    this.serverService.getConfig()
        .subscribe(config => this.requiresEmailVerification = config.signup.requiresEmailVerification)

    this.buildForm({
      'verify-email-email': USER_EMAIL_VALIDATOR
    })
  }

  askSendVerifyEmail () {
    const email = this.form.value['verify-email-email']
    this.userService.askSendVerifyEmail(email)
      .subscribe(
        () => {
          this.notifier.success($localize`An email with verification link will be sent to ${email}.`)
          this.redirectService.redirectToHomepage()
        },

        err => {
          this.notifier.error(err.message)
        }
      )
  }
}
