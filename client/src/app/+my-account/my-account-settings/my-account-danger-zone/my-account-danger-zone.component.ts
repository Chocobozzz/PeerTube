import { Component, Input } from '@angular/core'
import { AuthService, ConfirmService, Notifier, RedirectService, User, UserService } from '@app/core'

@Component({
  selector: 'my-account-danger-zone',
  templateUrl: './my-account-danger-zone.component.html',
  styleUrls: [ './my-account-danger-zone.component.scss' ],
  standalone: true
})
export class MyAccountDangerZoneComponent {
  @Input() user: User

  constructor (
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private confirmService: ConfirmService,
    private redirectService: RedirectService
  ) { }

  async deleteMe () {
    const res = await this.confirmService.confirmWithExpectedInput(
      $localize`Are you sure you want to delete your account?` +
        '<br /><br />' +
        // eslint-disable-next-line max-len
        $localize`This will delete all your data, including channels, videos, comments and you won't be able to create another user on this instance with "${this.user.username}" username.` +
        '<br /><br />' +
        $localize`Content cached by other servers and other third-parties might make longer to be deleted.`,

      $localize`Type your username to confirm`,
      this.user.username,
      $localize`Delete your account`,
      $localize`Delete my account`
    )
    if (res === false) return

    this.userService.deleteMe()
      .subscribe({
        next: () => {
          this.notifier.success($localize`Your account is deleted.`)

          this.authService.logout()
          this.redirectService.redirectToHomepage()
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
