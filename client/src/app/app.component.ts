import { Component } from '@angular/core';
import { HTTP_PROVIDERS } from '@angular/http';
import { Router, ROUTER_DIRECTIVES, ROUTER_PROVIDERS, Routes } from '@angular/router';

import { FriendService } from './friends';
import { LoginComponent } from './login';
import {
  AuthService,
  AuthStatus,
  Search,
  SearchComponent
} from './shared';
import {
  VideoAddComponent,
  VideoListComponent,
  VideoWatchComponent,
  VideoService
} from './videos';
import { SearchService } from './shared'; // Temporary

@Routes([
  {
    path: '/users/login',
    component: LoginComponent
  },
  {
    path: '/videos/list',
    component: VideoListComponent
  },
  {
    path: '/videos/watch/:id',
    component: VideoWatchComponent
  },
  {
    path: '/videos/add',
    component: VideoAddComponent
  },
  {
    path: '/',
    component: VideoListComponent
  }
])

@Component({
    selector: 'my-app',
    template: require('./app.component.html'),
    styles: [ require('./app.component.scss') ],
    directives: [ ROUTER_DIRECTIVES, SearchComponent ],
    providers: [ AuthService, FriendService, HTTP_PROVIDERS, ROUTER_PROVIDERS, VideoService, SearchService ]
})

export class AppComponent {
  choices = [];
  isLoggedIn: boolean;

  constructor(
    private authService: AuthService,
    private friendService: FriendService,
    private router: Router
  ) {
    this.isLoggedIn = this.authService.isLoggedIn();

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true;
        }
      }
    );
  }

  onSearch(search: Search) {
    if (search.value !== '') {
      const params = {
        field: search.field,
        search: search.value
      };
      this.router.navigate(['/videos/list', params]);
    } else {
      this.router.navigate(['/videos/list']);
    }
  }

  // FIXME
  logout() {
    // this._authService.logout();
  }

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

  quitFriends() {
    this.friendService.quitFriends().subscribe(
      status => {
        alert('Quit friends!');
      },
      error => alert(error)
    );
  }
}
