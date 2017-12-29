import { HttpEventType, HttpResponse } from '@angular/common/http'
import { Component, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { VideoPrivacy } from '../../../../../shared/models/videos'
import { User } from '../../shared'
import { AuthService } from '../../core'
import { UserService } from '../../shared/users'

@Component({
  selector: 'my-account-settings',
  templateUrl: './account-settings.component.html',
  styleUrls: [ './account-settings.component.scss' ]
})
export class AccountSettingsComponent implements OnInit {
  @ViewChild('avatarfileInput') avatarfileInput

  user: User = null

  constructor (
    private userService: UserService,
    private authService: AuthService,
    private notificationsService: NotificationsService
  ) {}

  ngOnInit () {
    this.user = this.authService.getUser()
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
}
