import { Component, Input } from '@angular/core'
import { AuthService, ConfirmService, Notifier, RedirectService, User, UserService } from '@app/core'

@Component({
  selector: 'my-account-danger-zone',
  templateUrl: './my-account-danger-zone.component.html',
  styleUrls: [ './my-account-danger-zone.component.scss' ]
})
export class MyAccountDangerZoneComponent {
  @Input() user: User = null

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private confirmService: ConfirmService,
    private redirectService: RedirectService
    ) { }

  async deleteMe () {
    const res = await this.confirmService.confirmWithInput(
      $localize`Are you sure you want to delete your account? This will delete all your data, including channels, videos and comments. Content cached by other servers and other third-parties might make longer to be deleted.`,
      $localize`Type your username to confirm`,
      this.user.username,
      $localize`Delete your account`,
      $localize`Delete my account`
    )
    if (res === false) return

    this.userService.deleteMe().subscribe(
      () => {
        this.notifier.success($localize`Your account is deleted.`)

        this.authService.logout()
        this.redirectService.redirectToHomepage()
      },

      err => this.notifier.error(err.message)
    )
  }
}
