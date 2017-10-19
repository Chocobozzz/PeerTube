import { Component, OnInit } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'
import { SortMeta } from 'primeng/primeng'

import { ConfirmService } from '../../../core'
import { RestTable, RestPagination } from '../../../shared'
import { Pod } from '../../../../../../shared'
import { FriendService } from '../shared'

@Component({
  selector: 'my-friend-list',
  templateUrl: './friend-list.component.html',
  styleUrls: ['./friend-list.component.scss']
})
export class FriendListComponent extends RestTable implements OnInit {
  friends: Pod[] = []
  totalRecords = 0
  rowsPerPage = 10
  sort: SortMeta = { field: 'id', order: 1 }
  pagination: RestPagination = { count: this.rowsPerPage, start: 0 }

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private friendService: FriendService
  ) {
    super()
  }

  ngOnInit () {
    this.loadData()
  }

  hasFriends () {
    return this.friends.length !== 0
  }

  quitFriends () {
    const confirmMessage = 'Do you really want to quit your friends? All their videos will be deleted.'
    this.confirmService.confirm(confirmMessage, 'Quit friends').subscribe(
      res => {
        if (res === false) return

        this.friendService.quitFriends().subscribe(
          status => {
            this.notificationsService.success('Success', 'Friends left!')
            this.loadData()
          },

          err => this.notificationsService.error('Error', err.message)
        )
      }
    )
  }

  removeFriend (friend: Pod) {
    const confirmMessage = 'Do you really want to remove this friend ? All its videos will be deleted.'

    this.confirmService.confirm(confirmMessage, 'Remove').subscribe(
      res => {
        if (res === false) return

        this.friendService.removeFriend(friend).subscribe(
          status => {
            this.notificationsService.success('Success', 'Friend removed')
            this.loadData()
          },

          err => this.notificationsService.error('Error', err.message)
        )
      }
    )
  }

  protected loadData () {
    this.friendService.getFriends(this.pagination, this.sort)
                      .subscribe(
                        resultList => {
                          this.friends = resultList.data
                          this.totalRecords = resultList.total
                        },

                        err => this.notificationsService.error('Error', err.message)
                      )
  }
}
