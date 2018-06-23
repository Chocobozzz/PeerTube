import { Component, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { BytesPipe } from 'ngx-pipes'
import { AuthService } from '../../core'
import { ServerService } from '../../core/server'
import { User } from '../../shared'
import { UserService } from '../../shared/users'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-account-settings',
  templateUrl: './my-account-settings.component.html',
  styleUrls: [ './my-account-settings.component.scss' ]
})
export class MyAccountSettingsComponent implements OnInit {
  @ViewChild('avatarfileInput') avatarfileInput

  user: User = null
  userVideoQuota = '0'
  userVideoQuotaUsed = 0

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private serverService: ServerService,
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {}

  get userInformationLoaded () {
    return this.authService.userInformationLoaded
  }

  ngOnInit () {
    this.user = this.authService.getUser()

    this.authService.userInformationLoaded.subscribe(
      () => {
        if (this.user.videoQuota !== -1) {
          this.userVideoQuota = new BytesPipe().transform(this.user.videoQuota, 0).toString()
        } else {
          this.userVideoQuota = this.i18n('Unlimited')
        }
      }
    )

    this.userService.getMyVideoQuotaUsed()
      .subscribe(data => this.userVideoQuotaUsed = data.videoQuotaUsed)
  }

  changeAvatar () {
    const avatarfile = this.avatarfileInput.nativeElement.files[ 0 ]
    if (avatarfile.size > this.maxAvatarSize) {
      this.notificationsService.error('Error', 'This image is too large.')
      return
    }

    const formData = new FormData()
    formData.append('avatarfile', avatarfile)

    this.userService.changeAvatar(formData)
      .subscribe(
        data => {
          this.notificationsService.success(this.i18n('Success'), this.i18n('Avatar changed.'))

          this.user.updateAccountAvatar(data.avatar)
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  get maxAvatarSize () {
    return this.serverService.getConfig().avatar.file.size.max
  }

  get avatarExtensions () {
    return this.serverService.getConfig().avatar.file.extensions.join(',')
  }
}
