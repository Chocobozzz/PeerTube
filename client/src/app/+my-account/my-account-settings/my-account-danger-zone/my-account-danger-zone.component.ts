import { Component, inject, input } from '@angular/core'
import { AuthService, ConfirmService, Notifier, RedirectService, User, UserService } from '@app/core'

@Component({
  selector: 'my-account-danger-zone',
  templateUrl: './my-account-danger-zone.component.html',
  standalone: true
})
export class MyAccountDangerZoneComponent {
  private authService = inject(AuthService)
  private notifier = inject(Notifier)
  private userService = inject(UserService)
  private confirmService = inject(ConfirmService)
  private redirectService = inject(RedirectService)

  readonly user = input<User>(undefined)

  async deleteMe () {
    const res = await this.confirmService.confirmWithExpectedInput(
      $localize`Are you sure you want to delete your account?` +
        '<br /><br />' +
        // eslint-disable-next-line max-len
        $localize`This will delete all your data, including channels, videos, comments and you won't be able to create another user on this instance with "${this.user().username}" username.` +
        '<br /><br />' +
        $localize`Content cached by other servers and other third-parties might make longer to be deleted.`,
      $localize`Type your username to confirm`,
      this.user().username,
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

        error: err => this.notifier.handleError(err)
      })
  }
}
