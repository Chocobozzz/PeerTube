import { SortMeta, SharedModule } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, RestPagination, RestTable } from '@app/core'
import { VideoChangeOwnership, VideoChangeOwnershipStatus, VideoChangeOwnershipStatusType } from '@peertube/peertube-models'
import { MyAcceptOwnershipComponent } from './my-accept-ownership/my-accept-ownership.component'
import { AutoColspanDirective } from '../../shared/shared-main/angular/auto-colspan.directive'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { ButtonComponent } from '../../shared/shared-main/buttons/button.component'
import { NgIf, NgClass, DatePipe } from '@angular/common'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { TableModule } from 'primeng/table'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoOwnershipService } from '@app/shared/shared-main/video/video-ownership.service'
import { Account } from '@app/shared/shared-main/account/account.model'

@Component({
  templateUrl: './my-ownership.component.html',
  styleUrls: [ './my-ownership.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    NgbTooltip,
    NgIf,
    ButtonComponent,
    ActorAvatarComponent,
    NgClass,
    AutoColspanDirective,
    MyAcceptOwnershipComponent,
    DatePipe
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
