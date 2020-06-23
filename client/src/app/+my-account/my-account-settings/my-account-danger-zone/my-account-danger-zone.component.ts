import { Component, Input } from '@angular/core'
import { AuthService, ConfirmService, Notifier, RedirectService, User, UserService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

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
    private redirectService: RedirectService,
    private i18n: I18n
  ) { }

  async deleteMe () {
    const res = await this.confirmService.confirmWithInput(
      this.i18n('Are you sure you want to delete your account? This will delete all your data, including channels, videos and comments. Content cached by other servers and other third-parties might make longer to be deleted.'),
      this.i18n('Type your username to confirm'),
      this.user.username,
      this.i18n('Delete your account'),
      this.i18n('Delete my account')
    )
    if (res === false) return

    this.userService.deleteMe().subscribe(
      () => {
        this.notifier.success(this.i18n('Your account is deleted.'))

        this.authService.logout()
        this.redirectService.redirectToHomepage()
      },

      err => this.notifier.error(err.message)
    )
  }
}
