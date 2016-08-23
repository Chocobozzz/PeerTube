import { Component, OnInit } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

import { Friend, FriendService } from '../shared';

@Component({
  selector: 'my-friend-list',
  template: require('./friend-list.component.html'),
  styles: [ require('./friend-list.component.scss') ],
  directives: [ ROUTER_DIRECTIVES ]
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
