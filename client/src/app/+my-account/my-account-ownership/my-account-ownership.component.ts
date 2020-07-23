import { SortMeta } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { VideoOwnershipService, Actor, Video, Account } from '@app/shared/shared-main'
import { VideoChangeOwnership, VideoChangeOwnershipStatus } from '@shared/models'
import { MyAccountAcceptOwnershipComponent } from './my-account-accept-ownership/my-account-accept-ownership.component'
import { getAbsoluteAPIUrl } from '@app/helpers'

@Component({
  selector: 'my-account-ownership',
  templateUrl: './my-account-ownership.component.html',
  styleUrls: [ './my-account-ownership.component.scss' ]
})
export class MyAccountOwnershipComponent extends RestTable implements OnInit {
  videoChangeOwnerships: VideoChangeOwnership[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  @ViewChild('myAccountAcceptOwnershipComponent', { static: true }) myAccountAcceptOwnershipComponent: MyAccountAcceptOwnershipComponent

  constructor (
    private notifier: Notifier,
    private videoOwnershipService: VideoOwnershipService
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  getIdentifier () {
    return 'MyAccountOwnershipComponent'
  }

  getStatusClass (status: VideoChangeOwnershipStatus) {
    switch (status) {
      case VideoChangeOwnershipStatus.ACCEPTED:
        return 'badge-green'
      case VideoChangeOwnershipStatus.REFUSED:
        return 'badge-red'
      default:
        return 'badge-yellow'
    }
  }

  switchToDefaultAvatar ($event: Event) {
    ($event.target as HTMLImageElement).src = Actor.GET_DEFAULT_AVATAR_URL()
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
        err => this.notifier.error(err.message)
      )
  }

  protected loadData () {
    return this.videoOwnershipService.getOwnershipChanges(this.pagination, this.sort)
      .subscribe(
        resultList => {
          this.videoChangeOwnerships = resultList.data.map(change => ({
            ...change,
            initiatorAccount: new Account(change.initiatorAccount),
            nextOwnerAccount: new Account(change.nextOwnerAccount)
          }))
          this.totalRecords = resultList.total
        },

        err => this.notifier.error(err.message)
      )
  }
}
