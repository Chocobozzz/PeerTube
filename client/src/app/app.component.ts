import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'my-app',
    templateUrl: './app.component.html',
    styleUrls: [ './app.component.scss' ]
})

export class AppComponent {
  constructor(private router: Router) {}

  isInAdmin() {
    return this.router.url.indexOf('/admin/') !== -1;
  }
}
