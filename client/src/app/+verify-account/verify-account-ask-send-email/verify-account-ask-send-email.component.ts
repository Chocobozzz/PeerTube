import { Component, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { Notifier, RedirectService } from '@app/core'
import { ServerService } from '@app/core/server'
import { FormReactive, UserService } from '@app/shared'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { UserValidatorsService } from '@app/shared/forms/form-validators/user-validators.service'

@Component({
  selector: 'my-verify-account-ask-send-email',
  templateUrl: './verify-account-ask-send-email.component.html',
  styleUrls: [ './verify-account-ask-send-email.component.scss' ]
})

export class VerifyAccountAskSendEmailComponent extends FormReactive implements OnInit {

  constructor (
    protected formValidatorService: FormValidatorService,
    private userValidatorsService: UserValidatorsService,
    private userService: UserService,
    private serverService: ServerService,
    private notifier: Notifier,
    private redirectService: RedirectService,
    private i18n: I18n
  ) {
    super()
  }

  get requiresEmailVerification () {
    return this.serverService.getConfig().signup.requiresEmailVerification
  }

  ngOnInit () {
    this.buildForm({
      'verify-email-email': this.userValidatorsService.USER_EMAIL
    })
  }

  askSendVerifyEmail () {
    const email = this.form.value['verify-email-email']
    this.userService.askSendVerifyEmail(email)
      .subscribe(
        () => {
          const message = this.i18n(
            'An email with verification link will be sent to {{email}}.',
            { email }
          )
          this.notifier.success(message)
          this.redirectService.redirectToHomepage()
        },

        err => {
          this.notifier.error(err.message)
        }
      )
  }
}
