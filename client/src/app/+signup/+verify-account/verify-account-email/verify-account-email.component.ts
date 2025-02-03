import { NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { SignupService } from '@app/+signup/shared/signup.service'
import { AuthService, Notifier, ServerService } from '@app/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { SignupSuccessAfterEmailComponent } from '../../shared/signup-success-after-email.component'

@Component({
  selector: 'my-verify-account-email',
  templateUrl: './verify-account-email.component.html',
  imports: [ NgIf, SignupSuccessAfterEmailComponent, RouterLink, AlertComponent ]
})

export class VerifyAccountEmailComponent implements OnInit {
  success = false
  failed = false
  isPendingEmail = false

  requiresApproval: boolean
  loaded = false

  private userId: number
  private registrationId: number
  private verificationString: string

  constructor (
    private signupService: SignupService,
    private server: ServerService,
    private authService: AuthService,
    private notifier: Notifier,
    private route: ActivatedRoute
  ) {
  }

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

  isRegistrationRequest () {
    return !!this.registrationId
  }

  displaySignupSuccess () {
    if (!this.success) return false
    if (!this.isRegistrationRequest() && this.isPendingEmail) return false

    return true
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

    this.signupService.verifyUserEmail(options)
      .subscribe({
        next: () => {
          if (this.authService.isLoggedIn()) {
            this.authService.refreshUserInformation()
          }

          this.success = true
        },

        error: err => {
          this.failed = true

          this.notifier.error(err.message)
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

          this.notifier.error(err.message)
        }
      })
  }
}
