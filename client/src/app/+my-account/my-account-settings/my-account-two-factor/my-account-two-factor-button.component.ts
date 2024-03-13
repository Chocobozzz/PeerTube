import { Subject } from 'rxjs'
import { Component, Input, OnInit } from '@angular/core'
import { AuthService, ConfirmService, Notifier, User } from '@app/core'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { NgIf } from '@angular/common'
import { TwoFactorService } from '@app/shared/shared-users/two-factor.service'

@Component({
  selector: 'my-account-two-factor-button',
  templateUrl: './my-account-two-factor-button.component.html',
  standalone: true,
  imports: [ NgIf, ButtonComponent ]
})
export class MyAccountTwoFactorButtonComponent implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

  twoFactorEnabled = false

  constructor (
    private notifier: Notifier,
    private twoFactorService: TwoFactorService,
    private confirmService: ConfirmService,
    private auth: AuthService
  ) {
  }

  ngOnInit () {
    this.userInformationLoaded.subscribe(() => {
      this.twoFactorEnabled = this.user.twoFactorEnabled
    })
  }

  async disableTwoFactor () {
    const message = $localize`Are you sure you want to disable two factor authentication of your account?`

    const { confirmed, password } = await this.confirmService.confirmWithPassword({ message, title: $localize`Disable two factor` })
    if (confirmed === false) return

    this.twoFactorService.disableTwoFactor({ userId: this.user.id, currentPassword: password })
      .subscribe({
        next: () => {
          this.twoFactorEnabled = false

          this.auth.refreshUserInformation()

          this.notifier.success($localize`Two factor authentication disabled`)
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
