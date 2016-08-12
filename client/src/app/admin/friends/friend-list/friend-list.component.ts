import { Component, OnInit } from '@angular/core';

import { Friend, FriendService } from '../shared';

@Component({
  selector: 'my-friend-list',
  template: require('./friend-list.component.html'),
  styles: [ require('./friend-list.component.scss') ]
})
export class FriendListComponent implements OnInit {
  friends: Friend[];

  constructor(private friendService: FriendService) {  }

  ngOnInit() {
    this.friendService.getFriends().subscribe(
      friends => this.friends = friends,

      err => alert(err)
    );
  }

  makeFriends() {
    this.friendService.makeFriends().subscribe(
      status => {
        if (status === 409) {
          alert('Already made friends!');
        } else {
          alert('Made friends!');
        }
      },
      error => alert(error)
    );
  }

  quitFriends() {
    if (!confirm('Are you sure?')) return;

    this.friendService.quitFriends().subscribe(
      status => {
        alert('Quit friends!');
      },
      error => alert(error)
    );
  }
}
