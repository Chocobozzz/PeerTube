import { ViewportScroller } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { AfterViewChecked, Component, OnInit, inject } from '@angular/core'
import { AuthService, Notifier, User, UserService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'
import { shallowCopy } from '@peertube/peertube-core-utils'
import { ActorAvatarEditComponent } from '../../shared/shared-actor-image-edit/actor-avatar-edit.component'
import { UserQuotaComponent } from '../../shared/shared-main/users/user-quota.component'
import { UserInterfaceSettingsComponent } from '../../shared/shared-user-settings/user-interface-settings.component'
import { UserVideoSettingsComponent } from '../../shared/shared-user-settings/user-video-settings.component'
import { AccountTokenSessionsComponent } from '../../shared/shared-users/account-token-sessions.component'
import { MyAccountChangeEmailComponent } from './my-account-change-email/my-account-change-email.component'
import { MyAccountChangePasswordComponent } from './my-account-change-password/my-account-change-password.component'
import { MyAccountDangerZoneComponent } from './my-account-danger-zone/my-account-danger-zone.component'
import { MyAccountEmailPreferencesComponent } from './my-account-email-preferences/my-account-email-preferences.component'
import {
  MyAccountNotificationPreferencesComponent
} from './my-account-notification-preferences/my-account-notification-preferences.component'
import { MyAccountProfileComponent } from './my-account-profile/my-account-profile.component'
import { MyAccountTwoFactorButtonComponent } from './my-account-two-factor/my-account-two-factor-button.component'

@Component({
  selector: 'my-account-settings',
  templateUrl: './my-account-settings.component.html',
  styleUrls: [ './my-account-settings.component.scss' ],
  imports: [
    ActorAvatarEditComponent,
    UserQuotaComponent,
    MyAccountProfileComponent,
    UserInterfaceSettingsComponent,
    UserVideoSettingsComponent,
    MyAccountNotificationPreferencesComponent,
    MyAccountChangePasswordComponent,
    MyAccountTwoFactorButtonComponent,
    MyAccountEmailPreferencesComponent,
    MyAccountChangeEmailComponent,
    MyAccountDangerZoneComponent,
    AccountTokenSessionsComponent
  ]
})
export class MyAccountSettingsComponent implements OnInit, AfterViewChecked {
  private viewportScroller = inject(ViewportScroller)
  private userService = inject(UserService)
  private authService = inject(AuthService)
  private notifier = inject(Notifier)

  user: User

  private lastScrollHash: string

  get userInformationLoaded () {
    return this.authService.userInformationLoaded
  }

  ngOnInit () {
    this.user = this.authService.getUser()
  }

  ngAfterViewChecked () {
    if (window.location.hash && window.location.hash !== this.lastScrollHash) {
      this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))

      this.lastScrollHash = window.location.hash
    }
  }

  onAvatarChange (formData: FormData) {
    this.userService.changeAvatar(formData)
      .subscribe({
        next: data => {
          this.notifier.success($localize`Avatar changed.`)

          this.user.updateAccountAvatar(data.avatars)

          // So my-actor-avatar component detects changes
          this.user.account = shallowCopy(this.user.account)
        },

        error: (err: HttpErrorResponse) =>
          genericUploadErrorHandler({
            err,
            name: $localize`avatar`,
            notifier: this.notifier
          })
      })
  }

  onAvatarDelete () {
    this.userService.deleteAvatar()
      .subscribe({
        next: () => {
          this.notifier.success($localize`Avatar deleted.`)

          this.user.updateAccountAvatar()

          // So my-actor-avatar component detects changes
          this.user.account = shallowCopy(this.user.account)
        },

        error: (err: HttpErrorResponse) => this.notifier.error(err.message)
      })
  }
}
