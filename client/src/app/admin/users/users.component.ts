import { Component } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

import { UserService } from './shared';

@Component({
    template: '<router-outlet></router-outlet>',
    directives: [ ROUTER_DIRECTIVES ],
    providers: [ UserService ]
})

export class UsersComponent {
}
