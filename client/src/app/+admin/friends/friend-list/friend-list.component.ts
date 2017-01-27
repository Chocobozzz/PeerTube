import { Component, OnInit } from '@angular/core';

import { NotificationsService } from 'angular2-notifications';

import { ConfirmService } from '../../../core';
import { Friend, FriendService } from '../shared';

@Component({
  selector: 'my-friend-list',
  templateUrl: './friend-list.component.html',
  styleUrls: [ './friend-list.component.scss' ]
})
export class FriendListComponent implements OnInit {
  friends: Friend[];

  constructor(
    private notificationsService: NotificationsService,
    private confirmService: ConfirmService,
    private friendService: FriendService
  ) {  }

  ngOnInit() {
    this.getFriends();
  }

  quitFriends() {
    const confirmMessage = 'Do you really want to quit your friends? All their videos will be deleted.';
    this.confirmService.confirm(confirmMessage, 'Quit friends').subscribe(
      res => {
        if (res === false) return;

        this.friendService.quitFriends().subscribe(
          status => {
            this.notificationsService.success('Sucess', 'Friends left!');

            this.getFriends();
          },

          err => this.notificationsService.error('Error', err.text)
        );
      }
    );
  }

  private getFriends() {
    this.friendService.getFriends().subscribe(
      res => this.friends = res.friends,

      err => this.notificationsService.error('Error', err.text)
    );
  }
}
