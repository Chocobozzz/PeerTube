import { Component } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

import { FriendService } from './shared';

@Component({
    template: '<router-outlet></router-outlet>',
    directives: [ ROUTER_DIRECTIVES ],
    providers: [ FriendService ]
})

export class FriendsComponent {
}
