import { Component, OnInit } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/primeng'

import { ConfirmService } from '../../../core'
import { RestTable, RestPagination } from '../../../shared'
import { Pod } from '../../../../../../shared'
import { FollowService } from '../shared'

@Component({
  selector: 'my-followers-list',
  templateUrl: './following-list.component.html'
})
export class FollowingListComponent extends RestTable {
  following: Pod[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private followService: FollowService
  ) {
    super()
  }

  protected loadData () {
    this.followService.getFollowing(this.pagination, this.sort)
                      .subscribe(
                        resultList => {
                          this.following = resultList.data
                          this.totalRecords = resultList.total
                        },

                        err => this.notificationsService.error('Error', err.message)
                      )
  }
}
