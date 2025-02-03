import { Component, OnInit } from '@angular/core'
import { SignupService } from '@app/+signup/shared/signup.service'
import { Notifier, RedirectService, ServerService } from '@app/core'
import { USER_EMAIL_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { NgIf, NgClass } from '@angular/common'

@Component({
  selector: 'my-verify-account-ask-send-email',
  templateUrl: './verify-account-ask-send-email.component.html',
  styleUrls: [ './verify-account-ask-send-email.component.scss' ],
  imports: [ NgIf, FormsModule, ReactiveFormsModule, NgClass ]
})

export class VerifyAccountAskSendEmailComponent extends FormReactive implements OnInit {
  requiresEmailVerification = false

  constructor (
    protected formReactiveService: FormReactiveService,
    private signupService: SignupService,
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
    this.signupService.askSendVerifyEmail(email)
      .subscribe({
        next: () => {
          this.notifier.success($localize`An email with verification link will be sent to ${email}.`)
          this.redirectService.redirectToHomepage()
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
