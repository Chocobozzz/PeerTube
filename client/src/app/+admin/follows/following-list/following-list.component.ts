import { Component, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/primeng'
import { AccountFollow } from '../../../../../../shared/models/actors/follow.model'
import { ConfirmService } from '../../../core/confirm/confirm.service'
import { RestPagination, RestTable } from '../../../shared'
import { FollowService } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-followers-list',
  templateUrl: './following-list.component.html'
})
export class FollowingListComponent extends RestTable implements OnInit {
  following: AccountFollow[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private followService: FollowService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.loadSort()
  }

  async removeFollowing (follow: AccountFollow) {
    const res = await this.confirmService.confirm(
      this.i18n('Do you really want to unfollow {{host}}?', { host: follow.following.host }),
      this.i18n('Unfollow')
    )
    if (res === false) return

    this.followService.unfollow(follow).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('You are not following {{host}} anymore.', { host: follow.following.host })
        )
        this.loadData()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }

  protected loadData () {
    this.followService.getFollowing(this.pagination, this.sort)
                      .subscribe(
                        resultList => {
                          this.following = resultList.data
                          this.totalRecords = resultList.total
                        },

                        err => this.notificationsService.error(this.i18n('Error'), err.message)
                      )
  }
}
