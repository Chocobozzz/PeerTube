import { Component } from '@angular/core';
import { HTTP_PROVIDERS } from '@angular/http';
import { RouteConfig, Router, ROUTER_DIRECTIVES, ROUTER_PROVIDERS } from '@angular/router-deprecated';

import { FriendService } from './friends/index';
import { Search, SearchComponent } from './shared/index';
import {
  UserLoginComponent,
  AuthService,
  AuthStatus
} from './users/index';
import {
  VideoAddComponent,
  VideoListComponent,
  VideoWatchComponent,
  VideoService
} from './videos/index';

@RouteConfig([
  {
    path: '/users/login',
    name: 'UserLogin',
    component: UserLoginComponent
  },
  {
    path: '/videos/list',
    name: 'VideosList',
    component: VideoListComponent,
    useAsDefault: true
  },
  {
    path: '/videos/watch/:id',
    name: 'VideosWatch',
    component: VideoWatchComponent
  },
  {
    path: '/videos/add',
    name: 'VideosAdd',
    component: VideoAddComponent
  }
])

@Component({
    selector: 'my-app',
    templateUrl: 'client/app/app.component.html',
    styleUrls: [ 'client/app/app.component.css' ],
    directives: [ ROUTER_DIRECTIVES, SearchComponent ],
    providers: [ ROUTER_PROVIDERS, HTTP_PROVIDERS, VideoService, FriendService, AuthService ]
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
      this.router.navigate(['VideosList', params]);
    } else {
      this.router.navigate(['VideosList']);
    }
  }

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
