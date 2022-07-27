import { SortMeta } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { AdvancedInputFilter } from '@app/shared/shared-forms'
import { InstanceFollowService } from '@app/shared/shared-instance'
import { ActorFollow } from '@shared/models'
import { FollowModalComponent } from './follow-modal.component'

@Component({
  templateUrl: './following-list.component.html',
  styleUrls: [ './following-list.component.scss' ]
})
export class FollowingListComponent extends RestTable implements OnInit {
  @ViewChild('followModal') followModal: FollowModalComponent

  following: ActorFollow[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  searchFilters: AdvancedInputFilter[]

  constructor (
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private followService: InstanceFollowService
  ) {
    super()

    this.searchFilters = this.followService.buildFollowsListFilters()
  }

  ngOnInit () {
    this.initialize()
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

  async removeFollowing (follow: ActorFollow) {
    const res = await this.confirmService.confirm(
      $localize`Do you really want to unfollow ${follow.following.host}?`,
      $localize`Unfollow`
    )
    if (res === false) return

    this.followService.unfollow(follow)
      .subscribe({
        next: () => {
          this.notifier.success($localize`You are not following ${follow.following.host} anymore.`)
          this.reloadData()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  protected reloadData () {
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
