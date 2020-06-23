import { SortMeta } from 'primeng/api'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ConfirmService, Notifier, RestPagination, RestTable } from '@app/core'
import { InstanceFollowService } from '@app/shared/shared-instance'
import { BatchDomainsModalComponent } from '@app/shared/shared-moderation'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ActorFollow } from '@shared/models'

@Component({
  selector: 'my-followers-list',
  templateUrl: './following-list.component.html',
  styleUrls: [ '../follows.component.scss', './following-list.component.scss' ]
})
export class FollowingListComponent extends RestTable implements OnInit {
  @ViewChild('batchDomainsModal') batchDomainsModal: BatchDomainsModalComponent

  following: ActorFollow[] = []
  totalRecords = 0
  sort: SortMeta = { field: 'createdAt', order: -1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notifier: Notifier,
    private confirmService: ConfirmService,
    private followService: InstanceFollowService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.initialize()
  }

  getIdentifier () {
    return 'FollowingListComponent'
  }

  addDomainsToFollow () {
    this.batchDomainsModal.openModal()
  }

  httpEnabled () {
    return window.location.protocol === 'https:'
  }

  async addFollowing (hosts: string[]) {
    this.followService.follow(hosts).subscribe(
      () => {
        this.notifier.success(this.i18n('Follow request(s) sent!'))
        this.loadData()
      },

      err => this.notifier.error(err.message)
    )
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
