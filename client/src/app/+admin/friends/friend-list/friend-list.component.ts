import { Component, OnInit } from '@angular/core'

import { NotificationsService } from 'angular2-notifications'

import { ConfirmService } from '../../../core'
import { FriendService } from '../shared'
import { Pod } from '../../../../../../shared'

@Component({
  selector: 'my-friend-list',
  templateUrl: './friend-list.component.html',
  styleUrls: ['./friend-list.component.scss']
})
export class FriendListComponent implements OnInit {
  friends: Pod[] = []

  constructor (
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private friendService: FriendService
  ) {}

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

  private loadData () {
    this.friendService.getFriends()
                      .subscribe(
                        resultList => {
                          this.friends = resultList.data
                        },

                        err => this.notificationsService.error('Error', err.message)
                      )
  }
}
