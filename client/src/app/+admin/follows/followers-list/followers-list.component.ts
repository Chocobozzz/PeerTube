import { NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { formatICU } from '@app/helpers'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap'
import { ActorFollow } from '@peertube/peertube-models'
import { SharedModule, SortMeta } from 'primeng/api'
import { TableModule } from 'primeng/table'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { ActionDropdownComponent, DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { AutoColspanDirective } from '../../../shared/shared-main/common/auto-colspan.directive'

@Component({
  selector: 'my-followers-list',
  templateUrl: './followers-list.component.html',
  styleUrls: [ './followers-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    TableModule,
    SharedModule,
    NgIf,
    ActionDropdownComponent,
    AdvancedInputFilterComponent,
    NgbTooltip,
    ButtonComponent,
    DeleteButtonComponent,
    AutoColspanDirective,
    PTDatePipe
  ]
})
export class FollowersListComponent extends RestTable <ActorFollow> implements OnInit {
  followers: ActorFollow[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  searchFilters: AdvancedInputFilter[] = []

  bulkActions: DropdownAction<ActorFollow[]>[] = []

  constructor (
    private confirmService: ConfirmService,
    private notifier: Notifier,
    private followService: InstanceFollowService
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()

    this.searchFilters = this.followService.buildFollowsListFilters()

    this.bulkActions = [
      {
        label: $localize`Reject`,
        handler: follows => this.rejectFollower(follows),
        isDisplayed: follows => follows.every(f => f.state !== 'rejected')
      },
      {
        label: $localize`Accept`,
        handler: follows => this.acceptFollower(follows),
        isDisplayed: follows => follows.every(f => f.state !== 'accepted')
      },
      {
        label: $localize`Delete`,
        handler: follows => this.deleteFollowers(follows),
        isDisplayed: follows => follows.every(f => f.state === 'rejected')
      }
    ]
  }

  getIdentifier () {
    return 'FollowersListComponent'
  }

  acceptFollower (follows: ActorFollow[]) {
    this.followService.acceptFollower(follows)
      .subscribe({
        next: () => {
          // eslint-disable-next-line max-len
          const message = formatICU(
            $localize`Accepted {count, plural, =1 {{followerName} follow request} other {{count} follow requests}}`,
            { count: follows.length, followerName: this.buildFollowerName(follows[0]) }
          )
          this.notifier.success(message)

          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  async rejectFollower (follows: ActorFollow[]) {
    // eslint-disable-next-line max-len
    const message = formatICU(
      $localize`Do you really want to reject {count, plural, =1 {{followerName} follow request?} other {{count} follow requests?}}`,
      { count: follows.length, followerName: this.buildFollowerName(follows[0]) }
    )

    const res = await this.confirmService.confirm(message, $localize`Reject`)
    if (res === false) return

    this.followService.rejectFollower(follows)
        .subscribe({
          next: () => {
            // eslint-disable-next-line max-len
            const message = formatICU(
              $localize`Rejected {count, plural, =1 {{followerName} follow request} other {{count} follow requests}}`,
              { count: follows.length, followerName: this.buildFollowerName(follows[0]) }
            )
            this.notifier.success(message)

            this.reloadData()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  async deleteFollowers (follows: ActorFollow[]) {
    const icuParams = { count: follows.length, followerName: this.buildFollowerName(follows[0]) }

    let message = $localize`Deleted followers will be able to send again a follow request.`
    message += '<br /><br />'

    // eslint-disable-next-line max-len
    message += formatICU(
      $localize`Do you really want to delete {count, plural, =1 {{followerName} follow request?} other {{count} follow requests?}}`,
      icuParams
    )

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.followService.removeFollower(follows)
        .subscribe({
          next: () => {
            // eslint-disable-next-line max-len
            const message = formatICU(
              $localize`Removed {count, plural, =1 {{followerName} follow request} other {{count} follow requests}}`,
              icuParams
            )

            this.notifier.success(message)

            this.reloadData()
          },

          error: err => this.notifier.error(err.message)
        })
  }

  buildFollowerName (follow: ActorFollow) {
    return follow.follower.name + '@' + follow.follower.host
  }

  protected reloadDataInternal () {
    this.followService.getFollowers({ pagination: this.pagination, sort: this.sort, search: this.search })
                      .subscribe({
                        next: resultList => {
                          this.followers = resultList.data
                          this.totalRecords = resultList.total
                        },

                        error: err => this.notifier.error(err.message)
                      })
  }
}
