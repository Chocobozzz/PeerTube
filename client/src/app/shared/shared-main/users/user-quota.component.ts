import { NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { AuthService, UserService } from '@app/core'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { first } from 'rxjs'
import { BytesPipe } from '../angular/bytes.pipe'

@Component({
  selector: 'my-user-quota',
  templateUrl: './user-quota.component.html',
  styleUrls: [ './user-quota.component.scss' ],
  standalone: true,
  imports: [ NgbTooltip, NgIf, BytesPipe ]
})

export class UserQuotaComponent implements OnInit {
  userVideoQuota = '0'
  userVideoQuotaUsed = 0
  userVideoQuotaPercentage = 15

  userVideoQuotaDaily = '0'
  userVideoQuotaUsedDaily = 0
  userVideoQuotaDailyPercentage = 15

  constructor (
    private userService: UserService,
    private auth: AuthService
  ) { }

  get user () {
    return this.auth.getUser()
  }

  ngOnInit () {
    this.auth.userInformationLoaded.pipe(first()).subscribe(
      () => {
        if (this.user.videoQuota !== -1) {
          this.userVideoQuota = new BytesPipe().transform(this.user.videoQuota, 0).toString()
        } else {
          this.userVideoQuota = $localize`Unlimited`
        }

        if (this.user.videoQuotaDaily !== -1) {
          this.userVideoQuotaDaily = new BytesPipe().transform(this.user.videoQuotaDaily, 0).toString()
        } else {
          this.userVideoQuotaDaily = $localize`Unlimited`
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
