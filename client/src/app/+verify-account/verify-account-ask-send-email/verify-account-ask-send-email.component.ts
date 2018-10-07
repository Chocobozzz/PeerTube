import { Component, OnInit } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NotificationsService } from 'angular2-notifications'
import { ServerService } from '@app/core/server'
import { RedirectService } from '@app/core'
import { UserService, FormReactive } from '@app/shared'
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
    private notificationsService: NotificationsService,
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
          this.notificationsService.success(this.i18n('Success'), message)
          this.redirectService.redirectToHomepage()
        },

        err => {
          this.notificationsService.error(this.i18n('Error'), err.message)
        }
      )
  }
}
