import { Component, Input } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { AuthService, ConfirmService, RedirectService } from '../../../core'
import { UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { User } from '@app/shared'

@Component({
  selector: 'my-account-danger-zone',
  templateUrl: './my-account-danger-zone.component.html',
  styleUrls: [ './my-account-danger-zone.component.scss' ]
})
export class MyAccountDangerZoneComponent {
  @Input() user: User = null

  constructor (
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private confirmService: ConfirmService,
    private redirectService: RedirectService,
    private i18n: I18n
  ) { }

  async deleteMe () {
    const res = await this.confirmService.confirmWithInput(
      this.i18n('Are you sure you want to delete your account? This will delete all you data, including channels, videos etc.'),
      this.i18n('Type your username to confirm'),
      this.user.username,
      this.i18n('Delete your account'),
      this.i18n('Delete my account')
    )
    if (res === false) return

    this.userService.deleteMe().subscribe(
      () => {
        this.notificationsService.success(this.i18n('Success'), this.i18n('Your account is deleted.'))

        this.authService.logout()
        this.redirectService.redirectToHomepage()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }
}
