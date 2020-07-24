import { Subject } from 'rxjs'
import { BytesPipe } from 'ngx-pipes'
import { Component, Input, OnInit } from '@angular/core'
import { User, UserService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-user-quota',
  templateUrl: './user-quota.component.html',
  styleUrls: ['./user-quota.component.scss']
})

export class UserQuotaComponent implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

  userVideoQuota = '0'
  userVideoQuotaUsed = 0
  userVideoQuotaPercentage = 15

  userVideoQuotaDaily = '0'
  userVideoQuotaUsedDaily = 0
  userVideoQuotaDailyPercentage = 15

  constructor (
    private userService: UserService,
    private i18n: I18n
  ) { }

  ngOnInit () {
    this.userInformationLoaded.subscribe(
      () => {
        if (this.user.videoQuota !== -1) {
          this.userVideoQuota = new BytesPipe().transform(this.user.videoQuota, 0).toString()
        } else {
          this.userVideoQuota = this.i18n('Unlimited')
        }

        if (this.user.videoQuotaDaily !== -1) {
          this.userVideoQuotaDaily = new BytesPipe().transform(this.user.videoQuotaDaily, 0).toString()
        } else {
          this.userVideoQuotaDaily = this.i18n('Unlimited')
        }
      }
    )

    this.userService.getMyVideoQuotaUsed()
      .subscribe(data => {
        this.userVideoQuotaUsed = data.videoQuotaUsed
        this.userVideoQuotaPercentage = this.userVideoQuotaUsed * 100 / this.user.videoQuota

        this.userVideoQuotaUsedDaily = data.videoQuotaUsedDaily
        this.userVideoQuotaDailyPercentage = this.userVideoQuotaUsedDaily * 100 / this.user.videoQuotaDaily
      })
  }

  hasDailyQuota () {
    return this.user.videoQuotaDaily !== -1
  }

  titleVideoQuota () {
    return `${new BytesPipe().transform(this.userVideoQuotaUsed, 0).toString()} / ${this.userVideoQuota}`
  }

  titleVideoQuotaDaily () {
    return `${new BytesPipe().transform(this.userVideoQuotaUsedDaily, 0).toString()} / ${this.userVideoQuotaDaily}`
  }
}
