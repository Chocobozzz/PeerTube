import { NgIf } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { formatICU } from '@app/helpers'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { ActorFollow } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { AutoColspanDirective } from '../../../shared/shared-main/common/auto-colspan.directive'
import { RedundancyCheckboxComponent } from '../shared/redundancy-checkbox.component'
import { FollowModalComponent } from './follow-modal.component'

@Component({
  templateUrl: './following-list.component.html',
  styleUrls: [ './following-list.component.scss' ],
  standalone: true,
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    NgIf,
    ActionDropdownComponent,
    AdvancedInputFilterComponent,
    DeleteButtonComponent,
    RedundancyCheckboxComponent,
    AutoColspanDirective,
    FollowModalComponent,
    PTDatePipe,
    ButtonComponent
  ]
})
export class FollowingListComponent extends RestTable <ActorFollow> implements OnInit {
  @ViewChild('followModal') followModal: FollowModalComponent

  following: ActorFollow[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  searchFilters: AdvancedInputFilter[] = []

  bulkActions: DropdownAction<ActorFollow[]>[] = []

  constructor (
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private followService: InstanceFollowService
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()

    this.searchFilters = this.followService.buildFollowsListFilters()

    this.bulkActions = [
      {
        label: $localize`Delete`,
        handler: follows => this.removeFollowing(follows)
      }
    ]
  }

  getIdentifier () {
    return 'FollowingListComponent'
  }

  openFollowModal () {
    this.followModal.openModal()
  }

  isInstanceFollowing (follow: ActorFollow) {
    return follow.following.name === 'peertube'
  }

  buildFollowingName (follow: ActorFollow) {
    return follow.following.name + '@' + follow.following.host
  }

  async removeFollowing (follows: ActorFollow[]) {
    const icuParams = { count: follows.length, entryName: this.buildFollowingName(follows[0]) }

    const message = formatICU(
      $localize`Do you really want to unfollow {count, plural, =1 {{entryName}?} other {{count} entries?}}`,
      icuParams
    )

    const res = await this.confirmService.confirm(message, $localize`Unfollow`)
    if (res === false) return

    this.followService.unfollow(follows)
      .subscribe({
        next: () => {
          // eslint-disable-next-line max-len
          const message = formatICU(
            $localize`You are not following {count, plural, =1 {{entryName} anymore.} other {these {count} entries anymore.}}`,
            icuParams
          )

          this.notifier.success(message)
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  protected reloadDataInternal () {
    this.followService.getFollowing({ pagination: this.pagination, sort: this.sort, search: this.search })
                      .subscribe({
                        next: resultList => {
                          this.following = resultList.data
                          this.totalRecords = resultList.total
                        },

                        error: err => this.notifier.error(err.message)
                      })
  }
}
