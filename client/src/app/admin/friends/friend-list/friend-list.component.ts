import { Component, OnInit } from '@angular/core';

import { Friend, FriendService } from '../shared';

@Component({
  selector: 'my-friend-list',
  templateUrl: './friend-list.component.html',
  styleUrls: [ './friend-list.component.scss' ]
})
export class FriendListComponent implements OnInit {
  friends: Friend[];

  constructor(private friendService: FriendService) {  }

  ngOnInit() {
    this.getFriends();
  }

  quitFriends() {
    if (!confirm('Are you sure?')) return;

    this.friendService.quitFriends().subscribe(
      status => {
        alert('Quit friends!');
        this.getFriends();
      },
      error => alert(error)
    );
  }

  private getFriends() {
    this.friendService.getFriends().subscribe(
      friends => this.friends = friends,

      err => alert(err)
    );
  }
}
