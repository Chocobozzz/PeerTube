import { Component } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

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
  isInAdmin = false;

  onEnteredInAdmin() {
    this.isInAdmin = true;
  }

  onQuittedAdmin() {
    this.isInAdmin = false;
  }
}
