import { Component, OnInit, inject, input } from '@angular/core'
import { AuthService, ConfirmService, Notifier, User } from '@app/core'
import { TwoFactorService } from '@app/shared/shared-users/two-factor.service'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'

@Component({
  selector: 'my-account-two-factor-button',
  templateUrl: './my-account-two-factor-button.component.html',
  imports: [ ButtonComponent ]
})
export class MyAccountTwoFactorButtonComponent implements OnInit {
  private notifier = inject(Notifier)
  private twoFactorService = inject(TwoFactorService)
  private confirmService = inject(ConfirmService)
  private auth = inject(AuthService)

  readonly user = input<User>(undefined)

  twoFactorEnabled = false

  ngOnInit () {
    this.twoFactorEnabled = this.user().twoFactorEnabled
  }

  async disableTwoFactor () {
    const message = $localize`Are you sure you want to disable two factor authentication of your account?`

    const { confirmed, password } = await this.confirmService.confirmWithPassword({ message, title: $localize`Disable two factor` })
    if (confirmed === false) return

    this.twoFactorService.disableTwoFactor({ userId: this.user().id, currentPassword: password })
      .subscribe({
        next: () => {
          this.twoFactorEnabled = false

          this.auth.refreshUserInformation()

          this.notifier.success($localize`Two factor authentication disabled`)
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
