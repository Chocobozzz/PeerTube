import { Component } from '@angular/core';
import { Router, ROUTER_DIRECTIVES } from '@angular/router';

import { MenuAdminComponent } from './admin';
import { MenuComponent } from './menu.component';
import { SearchComponent, SearchService } from './shared';
import { VideoService } from './videos';

@Component({
    selector: 'my-app',
    template: require('./app.component.html'),
    styles: [ require('./app.component.scss') ],
    directives: [ MenuAdminComponent, MenuComponent, ROUTER_DIRECTIVES, SearchComponent ],
    providers: [ VideoService, SearchService ]
})

export class AppComponent {
  constructor(private router: Router) {}

  isInAdmin() {
    return this.router.url.indexOf('/admin/') !== -1;
  }
}
