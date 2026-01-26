import { Component, OnInit, inject } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { SignupService } from '@app/+signup/shared/signup.service'
import { AuthService, Notifier, ServerService, UserService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { SignupSuccessAfterEmailComponent } from '../../shared/signup-success-after-email.component'

@Component({
  selector: 'my-verify-account-email',
  templateUrl: './verify-account-email.component.html',
  imports: [ SignupSuccessAfterEmailComponent, RouterLink, AlertComponent ]
})
export class VerifyAccountEmailComponent implements OnInit {
  private signupService = inject(SignupService)
  private userService = inject(UserService)
  private server = inject(ServerService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private route = inject(ActivatedRoute)

  success = false
  failed = false
  isPendingEmail = false

  requiresApproval: boolean
  loaded = false

  private userId: number
  private registrationId: number
  private verificationString: string

  get instanceName () {
    return this.server.getHTMLConfig().instance.name
  }

  ngOnInit () {
    const queryParams = this.route.snapshot.queryParams

    this.server.getConfig().subscribe(config => {
      this.requiresApproval = config.signup.requiresApproval

      this.loaded = true
    })

    this.userId = queryParams['userId']
    this.registrationId = queryParams['registrationId']
    this.verificationString = queryParams['verificationString']
    this.isPendingEmail = queryParams['isPendingEmail'] === 'true'

    if (!this.verificationString) {
      this.notifier.error($localize`Unable to find verification string in URL query.`)
      return
    }

    if (!this.userId && !this.registrationId) {
      this.notifier.error($localize`Unable to find user id or registration id in URL query.`)
      return
    }

    this.verifyEmail()
  }

  isRegistration () {
    return !this.isPendingEmail
  }

  isRegistrationRequest () {
    return !!this.registrationId
  }

  verifyEmail () {
    if (this.isRegistrationRequest()) {
      return this.verifyRegistrationEmail()
    }

    return this.verifyUserEmail()
  }

  private verifyUserEmail () {
    const options = {
      userId: this.userId,
      verificationString: this.verificationString,
      isPendingEmail: this.isPendingEmail
    }

    this.userService.verifyUserEmail(options)
      .subscribe({
        next: () => {
          if (this.authService.isLoggedIn()) {
            this.authService.refreshUserInformation()
          }

          this.success = true
        },

        error: err => {
          this.failed = true

          this.notifier.handleError(err)
        }
      })
  }

  private verifyRegistrationEmail () {
    const options = {
      registrationId: this.registrationId,
      verificationString: this.verificationString
    }

    this.signupService.verifyRegistrationEmail(options)
      .subscribe({
        next: () => {
          this.success = true
        },

        error: err => {
          this.failed = true

          this.notifier.handleError(err)
        }
      })
  }
}
