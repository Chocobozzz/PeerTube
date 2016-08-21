import { Component } from '@angular/core';
import { ROUTER_DIRECTIVES } from '@angular/router';

@Component({
  selector: 'my-menu-admin',
  template: require('./menu-admin.component.html'),
  directives: [ ROUTER_DIRECTIVES ]
})
export class MenuAdminComponent { }
