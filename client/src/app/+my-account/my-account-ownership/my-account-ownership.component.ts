import { Component, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { RestPagination, RestTable } from '@app/shared'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { VideoChangeOwnership } from '../../../../../shared'
import { VideoOwnershipService } from '@app/shared/video-ownership'
import { Account } from '@app/shared/account/account.model'
import { MyAccountAcceptOwnershipComponent }
from '@app/+my-account/my-account-ownership/my-account-accept-ownership/my-account-accept-ownership.component'

@Component({
  selector: 'my-account-ownership',
  templateUrl: './my-account-ownership.component.html'
})
export class MyAccountOwnershipComponent extends RestTable implements OnInit {
  videoChangeOwnerships: VideoChangeOwnership[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  @ViewChild('myAccountAcceptOwnershipComponent') myAccountAcceptOwnershipComponent: MyAccountAcceptOwnershipComponent

  constructor (
    private notificationsService: NotificationsService,
    private videoOwnershipService: VideoOwnershipService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  createByString (account: Account) {
    return Account.CREATE_BY_STRING(account.name, account.host)
  }

  openAcceptModal (videoChangeOwnership: VideoChangeOwnership) {
    this.myAccountAcceptOwnershipComponent.show(videoChangeOwnership)
  }

  accepted () {
    this.loadData()
  }

  refuse (videoChangeOwnership: VideoChangeOwnership) {
    this.videoOwnershipService.refuseOwnership(videoChangeOwnership.id)
      .subscribe(
        () => this.loadData(),
        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

  protected loadData () {
    return this.videoOwnershipService.getOwnershipChanges(this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.videoChangeOwnerships = resultList.data
          this.totalRecords = resultList.total
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }
}
