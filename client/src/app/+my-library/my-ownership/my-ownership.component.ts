import { NgClass, NgIf } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { Account } from '@app/shared/shared-main/account/account.model'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { VideoOwnershipService } from '@app/shared/shared-main/video/video-ownership.service'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { VideoChangeOwnership, VideoChangeOwnershipStatus, VideoChangeOwnershipStatusType } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { AutoColspanDirective } from '../../shared/shared-main/common/auto-colspan.directive'
import { VideoCellComponent } from '../../shared/shared-tables/video-cell.component'
import { MyAcceptOwnershipComponent } from './my-accept-ownership/my-accept-ownership.component'

@Component({
  templateUrl: './my-ownership.component.html',
  imports: [
    TableModule,
    SharedModule,
    NgbTooltip,
    NgIf,
    ButtonComponent,
    ActorAvatarComponent,
    NgClass,
    AutoColspanDirective,
    MyAcceptOwnershipComponent,
    PTDatePipe,
    VideoCellComponent
  ]
})
export class MyOwnershipComponent extends RestTable implements OnInit {
  videoChangeOwnerships: VideoChangeOwnership[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  @ViewChild('myAcceptOwnershipComponent', { static: true }) myAccountAcceptOwnershipComponent: MyAcceptOwnershipComponent

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
    return 'MyOwnershipComponent'
  }

  getStatusClass (status: VideoChangeOwnershipStatusType) {
    switch (status) {
      case VideoChangeOwnershipStatus.ACCEPTED:
        return 'badge-green'
      case VideoChangeOwnershipStatus.REFUSED:
        return 'badge-red'
      default:
        return 'badge-yellow'
    }
  }

  openAcceptModal (videoChangeOwnership: VideoChangeOwnership) {
    this.myAccountAcceptOwnershipComponent.show(videoChangeOwnership)
  }

  accepted () {
    this.reloadData()
  }

  refuse (videoChangeOwnership: VideoChangeOwnership) {
    this.videoOwnershipService.refuseOwnership(videoChangeOwnership.id)
      .subscribe({
        next: () => this.reloadData(),
        error: err => this.notifier.error(err.message)
      })
  }

  protected reloadDataInternal () {
    return this.videoOwnershipService.getOwnershipChanges(this.pagination, this.sort)
      .subscribe({
        next: resultList => {
          this.videoChangeOwnerships = resultList.data.map(change => ({
            ...change,
            initiatorAccount: new Account(change.initiatorAccount),
            nextOwnerAccount: new Account(change.nextOwnerAccount)
          }))
          this.totalRecords = resultList.total
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
