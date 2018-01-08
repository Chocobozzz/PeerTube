import { Component, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../../core'
import { ServerService } from '../../core/server'
import { User } from '../../shared'
import { UserService } from '../../shared/users'

@Component({
  selector: 'my-account-settings',
  templateUrl: './account-settings.component.html',
  styleUrls: [ './account-settings.component.scss' ]
})
export class AccountSettingsComponent implements OnInit {
  @ViewChild('avatarfileInput') avatarfileInput

  user: User = null
  userVideoQuotaUsed = 0

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private serverService: ServerService,
    private notificationsService: NotificationsService
  ) {}

  ngOnInit () {
    this.user = this.authService.getUser()

    this.userService.getMyVideoQuotaUsed()
      .subscribe(data => this.userVideoQuotaUsed = data.videoQuotaUsed)
  }

  getAvatarUrl () {
    return this.user.getAvatarUrl()
  }

  changeAvatar () {
    const avatarfile = this.avatarfileInput.nativeElement.files[ 0 ]

    const formData = new FormData()
    formData.append('avatarfile', avatarfile)

    this.userService.changeAvatar(formData)
      .subscribe(
        data => {
          this.notificationsService.success('Success', 'Avatar changed.')

          this.user.account.avatar = data.avatar
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  get maxAvatarSize () {
    return this.serverService.getConfig().avatar.file.size.max
  }

  get avatarExtensions () {
    return this.serverService.getConfig().avatar.file.extensions.join(',')
  }
}
