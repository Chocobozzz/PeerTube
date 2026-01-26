import { Component, OnInit, inject, viewChild } from '@angular/core'
import { ConfirmService, Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { InstanceFollowService } from '@app/shared/shared-instance/instance-follow.service'
import { PTDatePipe } from '@app/shared/shared-main/common/date.pipe'
import { DataLoaderOptions, TableColumnInfo, TableComponent } from '@app/shared/shared-tables/table.component'
import { ActorFollow } from '@peertube/peertube-models'
import { AdvancedInputFilter, AdvancedInputFilterComponent } from '../../../shared/shared-forms/advanced-input-filter.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { DropdownAction } from '../../../shared/shared-main/buttons/action-dropdown.component'
import { ButtonComponent } from '../../../shared/shared-main/buttons/button.component'
import { DeleteButtonComponent } from '../../../shared/shared-main/buttons/delete-button.component'
import { NumberFormatterPipe } from '../../../shared/shared-main/common/number-formatter.pipe'

@Component({
  selector: 'my-followers-list',
  templateUrl: './followers-list.component.html',
  styleUrls: [ './followers-list.component.scss' ],
  imports: [
    GlobalIconComponent,
    AdvancedInputFilterComponent,
    ButtonComponent,
    DeleteButtonComponent,
    PTDatePipe,
    NumberFormatterPipe,
    TableComponent
  ]
})
export class FollowersListComponent implements OnInit {
  private confirmService = inject(ConfirmService)
  private notifier = inject(Notifier)
  private followService = inject(InstanceFollowService)

  readonly table = viewChild<TableComponent<ActorFollow>>('table')

  searchFilters: AdvancedInputFilter[] = []

  bulkActions: DropdownAction<ActorFollow[]>[] = []

  columns: TableColumnInfo<string>[] = [
    { id: 'follower', label: $localize`Follower`, sortable: false },
    { id: 'state', label: $localize`State`, sortable: true },
    { id: 'score', label: $localize`Reliability`, sortable: true },
    { id: 'createdAt', label: $localize`Created`, sortable: true }
  ]

  dataLoader: typeof this._dataLoader

  constructor () {
    this.dataLoader = this._dataLoader.bind(this)
  }

  ngOnInit () {
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

  acceptFollower (follows: ActorFollow[]) {
    this.followService.acceptFollower(follows)
      .subscribe({
        next: () => {
          const message = formatICU(
            $localize`Accepted {count, plural, =1 {{followerName} follow request} other {{count} follow requests}}`,
            { count: follows.length, followerName: this.buildFollowerName(follows[0]) }
          )
          this.notifier.success(message)

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async rejectFollower (follows: ActorFollow[]) {
    const message = formatICU(
      $localize`Do you really want to reject {count, plural, =1 {{followerName} follow request?} other {{count} follow requests?}}`,
      { count: follows.length, followerName: this.buildFollowerName(follows[0]) }
    )

    const res = await this.confirmService.confirm(message, $localize`Reject`)
    if (res === false) return

    this.followService.rejectFollower(follows)
      .subscribe({
        next: () => {
          const message = formatICU(
            $localize`Rejected {count, plural, =1 {{followerName} follow request} other {{count} follow requests}}`,
            { count: follows.length, followerName: this.buildFollowerName(follows[0]) }
          )
          this.notifier.success(message)

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  async deleteFollowers (follows: ActorFollow[]) {
    const icuParams = { count: follows.length, followerName: this.buildFollowerName(follows[0]) }

    let message = $localize`Deleted followers will be able to send again a follow request.`
    message += '<br /><br />'

    message += formatICU(
      $localize`Do you really want to delete {count, plural, =1 {{followerName} follow request?} other {{count} follow requests?}}`,
      icuParams
    )

    const res = await this.confirmService.confirm(message, $localize`Delete`)
    if (res === false) return

    this.followService.removeFollower(follows)
      .subscribe({
        next: () => {
          const message = formatICU(
            $localize`Removed {count, plural, =1 {{followerName} follow request} other {{count} follow requests}}`,
            icuParams
          )

          this.notifier.success(message)

          this.table().loadData()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  buildFollowerName (follow: ActorFollow) {
    return follow.follower.name + '@' + follow.follower.host
  }

  private _dataLoader (options: DataLoaderOptions) {
    const { pagination, sort, search } = options

    return this.followService.getFollowers({ pagination, sort, search })
  }
}
