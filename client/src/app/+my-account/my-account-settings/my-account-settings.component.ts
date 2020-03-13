import { Component, OnInit, AfterViewChecked } from '@angular/core'
import { Notifier } from '@app/core'
import { BytesPipe } from 'ngx-pipes'
import { AuthService } from '../../core'
import { User } from '../../shared'
import { UserService } from '../../shared/users'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ViewportScroller } from '@angular/common'

@Component({
  selector: 'my-account-settings',
  templateUrl: './my-account-settings.component.html',
  styleUrls: [ './my-account-settings.component.scss' ]
})
export class MyAccountSettingsComponent implements OnInit, AfterViewChecked {
  user: User = null

  userVideoQuota = '0'
  userVideoQuotaUsed = 0
  userVideoQuotaPercentage = 15

  userVideoQuotaDaily = '0'
  userVideoQuotaUsedDaily = 0
  userVideoQuotaDailyPercentage = 15

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

    this.authService.userInformationLoaded.subscribe(
      () => {
        if (this.user.videoQuota !== -1) {
          this.userVideoQuota = new BytesPipe().transform(this.user.videoQuota, 0).toString()
          this.userVideoQuotaPercentage = this.user.videoQuota * 100 / this.userVideoQuotaUsed
        } else {
          this.userVideoQuota = this.i18n('Unlimited')
        }

        if (this.user.videoQuotaDaily !== -1) {
          this.userVideoQuotaDaily = new BytesPipe().transform(this.user.videoQuotaDaily, 0).toString()
          this.userVideoQuotaDailyPercentage = this.user.videoQuotaDaily * 100 / this.userVideoQuotaUsedDaily
        } else {
          this.userVideoQuotaDaily = this.i18n('Unlimited')
        }
      }
    )

    this.userService.getMyVideoQuotaUsed()
      .subscribe(data => {
        this.userVideoQuotaUsed = data.videoQuotaUsed
        this.userVideoQuotaUsedDaily = data.videoQuotaUsedDaily
      })
  }

  ngAfterViewChecked () {
    if (window.location.hash) this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))
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

  hasDailyQuota () {
    return this.user.videoQuotaDaily !== -1
  }
}
