import { Component, Output, EventEmitter } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

import { FriendService } from './friends';

@Component({
  selector: 'my-menu-admin',
  template: require('./menu-admin.component.html'),
  directives: [ ROUTER_DIRECTIVES ],
  providers: [ FriendService ]
})
export class MenuAdminComponent {
  @Output() quittedAdmin = new EventEmitter<boolean>();

  constructor(private friendService: FriendService) {}

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

  quitAdmin() {
    this.quittedAdmin.emit(true);
  }

  quitFriends() {
    this.friendService.quitFriends().subscribe(
      status => {
        alert('Quit friends!');
      },
      error => alert(error)
    );
  }
}
