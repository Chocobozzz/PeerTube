import { Component, OnInit } from '@angular/core'
import { Notifier } from '@app/core'
import { SortMeta } from 'primeng/api'
import { ActorFollow } from '../../../../../../shared/models/actors/follow.model'
import { ConfirmService } from '../../../core/confirm/confirm.service'
import { RestPagination, RestTable } from '../../../shared'
import { FollowService } from '@app/shared/instance/follow.service'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-followers-list',
  templateUrl: './following-list.component.html',
  styleUrls: [ './following-list.component.scss' ]
})
export class FollowingListComponent extends RestTable implements OnInit {
  following: ActorFollow[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private followService: FollowService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  async removeFollowing (follow: ActorFollow) {
    const res = await this.confirmService.confirm(
      this.i18n('Do you really want to unfollow {{host}}?', { host: follow.following.host }),
      this.i18n('Unfollow')
    )
    if (res === false) return

    this.followService.unfollow(follow).subscribe(
      () => {
        this.notifier.success(this.i18n('You are not following {{host}} anymore.', { host: follow.following.host }))
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
  }

  protected loadData () {
    this.followService.getFollowing({ pagination: this.pagination, sort: this.sort, search: this.search })
                      .subscribe(
                        resultList => {
                          this.following = resultList.data
                          this.totalRecords = resultList.total
                        },

                        err => this.notifier.error(err.message)
                      )
  }
}
