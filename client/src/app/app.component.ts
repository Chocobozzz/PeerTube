import { Component, ViewContainerRef } from '@angular/core';
import { Router } from '@angular/router';

import { MetaService } from 'ng2-meta';
@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})

export class AppComponent {
  notificationOptions = {
    timeOut: 3000,
    lastOnBottom: true,
    clickToClose: true,
    maxLength: 0,
    maxStack: 7,
    showProgressBar: false,
    pauseOnHover: false,
    preventDuplicates: false,
    preventLastDuplicates: 'visible',
    rtl: false
  };

  constructor(
    private router: Router,
    private metaService: MetaService,
    viewContainerRef: ViewContainerRef
  ) {}

  isInAdmin() {
    return this.router.url.indexOf('/admin/') !== -1;
  }
}
