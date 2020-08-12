import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, Notifier, UserService } from '@app/core'

@Component({
  selector: 'my-verify-account-email',
  templateUrl: './verify-account-email.component.html'
})

export class VerifyAccountEmailComponent implements OnInit {
  success = false
  failed = false
  isPendingEmail = false

  private userId: number
  private verificationString: string

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private notifier: Notifier,
    private route: ActivatedRoute
    ) {
  }

  ngOnInit () {
    const queryParams = this.route.snapshot.queryParams
    this.userId = queryParams['userId']
    this.verificationString = queryParams['verificationString']
    this.isPendingEmail = queryParams['isPendingEmail'] === 'true'

    if (!this.userId || !this.verificationString) {
      this.notifier.error($localize`Unable to find user id or verification string.`)
    } else {
      this.verifyEmail()
    }
  }

  verifyEmail () {
    this.userService.verifyEmail(this.userId, this.verificationString, this.isPendingEmail)
      .subscribe(
        () => {
          if (this.authService.isLoggedIn()) {
            this.authService.refreshUserInformation()
          }

          this.success = true
        },

        err => {
          this.failed = true

          this.notifier.error(err.message)
        }
      )
  }
}
