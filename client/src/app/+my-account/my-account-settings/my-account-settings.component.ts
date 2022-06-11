import { ViewportScroller } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { AfterViewChecked, Component, OnInit } from '@angular/core'
import { AuthService, Notifier, User, UserService } from '@app/core'
import { genericUploadErrorHandler } from '@app/helpers'

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
    private notifier: Notifier
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
      .subscribe({
        next: data => {
          this.notifier.success($localize`Avatar changed.`)

          this.user.updateAccountAvatar(data.avatar)
        },

        error: (err: HttpErrorResponse) => genericUploadErrorHandler({
          err,
          name: $localize`avatar`,
          notifier: this.notifier
        })
      })
  }

  onAvatarDelete () {
    this.userService.deleteAvatar()
      .subscribe({
        next: data => {
          this.notifier.success($localize`Avatar deleted.`)

          this.user.updateAccountAvatar()
        },

        error: (err: HttpErrorResponse) => this.notifier.error(err.message)
      })
  }
}
