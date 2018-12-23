import { Component, OnInit } from '@angular/core'

import { Notifier } from '@app/core'
import { SortMeta } from 'primeng/primeng'
import { ActorFollow } from '../../../../../../shared/models/actors/follow.model'
import { RestPagination, RestTable } from '../../../shared'
import { FollowService } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-followers-list',
  templateUrl: './followers-list.component.html',
  styleUrls: [ './followers-list.component.scss' ]
})
export class FollowersListComponent extends RestTable implements OnInit {
  followers: ActorFollow[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'createdAt', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private followService: FollowService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  protected loadData () {
    this.followService.getFollowers(this.pagination, this.sort, this.search)
                      .subscribe(
                        resultList => {
                          this.followers = resultList.data
                          this.totalRecords = resultList.total
                        },

                        err => this.notifier.error(err.message)
                      )
  }
}
