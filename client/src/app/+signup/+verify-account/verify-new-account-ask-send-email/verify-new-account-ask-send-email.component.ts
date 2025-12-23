import { NgClass } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { SignupService } from '@app/+signup/shared/signup.service'
import { Notifier, RedirectService, ServerService, UserService } from '@app/core'
import { USER_EMAIL_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { forkJoin } from 'rxjs'

@Component({
  selector: 'my-verify-new-account-ask-send-email',
  templateUrl: './verify-new-account-ask-send-email.component.html',
  styleUrls: [ './verify-new-account-ask-send-email.component.scss' ],
  imports: [ FormsModule, ReactiveFormsModule, NgClass ]
})
export class VerifyNewAccountAskSendEmailComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private userService = inject(UserService)
  private signupService = inject(SignupService)
  private serverService = inject(ServerService)
  private notifier = inject(Notifier)
  private redirectService = inject(RedirectService)

  requiresEmailVerification = false

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  ngOnInit () {
    this.serverService.getConfig()
      .subscribe(config => {
        this.requiresEmailVerification = config.signup.requiresEmailVerification
      })

    this.buildForm({
      'verify-email-email': USER_EMAIL_VALIDATOR
    })
  }

  askSendVerifyEmail () {
    const email = this.form.value['verify-email-email']

    forkJoin([
      this.userService.askSendVerifyEmail(email),
      this.signupService.askSendVerifyEmail(email)
    ]).subscribe({
      next: () => {
        this.notifier.success($localize`An email with verification link will be sent to ${email}.`)
        this.redirectService.redirectToHomepage()
      },

      error: err => this.notifier.handleError(err)
    })
  }
}
