import { Component, ViewContainerRef } from '@angular/core';
import { Router } from '@angular/router';

import { MetaService } from 'ng2-meta/src';
@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.scss' ]
})

export class AppComponent {
  constructor(
    private router: Router,
    private metaService: MetaService,
    viewContainerRef: ViewContainerRef
  ) {}

  isInAdmin() {
    return this.router.url.indexOf('/admin/') !== -1;
  }
}
