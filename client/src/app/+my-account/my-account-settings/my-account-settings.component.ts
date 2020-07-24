import { ViewportScroller } from '@angular/common'
import { AfterViewChecked, Component, OnInit } from '@angular/core'
import { AuthService, Notifier, User, UserService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-account-settings',
  templateUrl: './my-account-settings.component.html',
  styleUrls: [ './my-account-settings.component.scss' ]
})
export class MyAccountSettingsComponent implements OnInit, AfterViewChecked {
  user: User = null

  private lastScrollHash: string

  constructor (
    private viewportScroller: ViewportScroller,
    private userService: UserService,
    private authService: AuthService,
    private notifier: Notifier,
    private i18n: I18n
  ) {}

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
      .subscribe(
        data => {
          this.notifier.success(this.i18n('Avatar changed.'))

          this.user.updateAccountAvatar(data.avatar)
        },

        err => this.notifier.error(err.message)
      )
  }
}
