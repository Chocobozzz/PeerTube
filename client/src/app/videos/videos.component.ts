import { Component } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

@Component({
    template: '<router-outlet></router-outlet>',
    directives: [ ROUTER_DIRECTIVES ]
})

export class VideosComponent {
}
