import { Component } from '@angular/core';
import { RouteConfig, ROUTER_DIRECTIVES, ROUTER_PROVIDERS, Router } from '@angular/router-deprecated';
import { HTTP_PROVIDERS } from '@angular/http';

import { DROPDOWN_DIRECTIVES} from  'ng2-bootstrap/components/dropdown';

import { VideosAddComponent } from '../videos/components/add/videos-add.component';
import { VideosListComponent } from '../videos/components/list/videos-list.component';
import { VideosWatchComponent } from '../videos/components/watch/videos-watch.component';
import { VideosService } from '../videos/videos.service';
import { FriendsService } from '../friends/services/friends.service';
import { UserLoginComponent } from '../users/components/login/login.component';
import { AuthService } from '../users/services/auth.service';
import { AuthStatus } from '../users/models/authStatus';
import { SearchComponent } from './search.component';
import { Search } from './search';

@RouteConfig([
  {
    path: '/users/login',
    name: 'UserLogin',
    component: UserLoginComponent
  },
  {
    path: '/videos/list',
    name: 'VideosList',
    component: VideosListComponent,
    useAsDefault: true
  },
  {
    path: '/videos/watch/:id',
    name: 'VideosWatch',
    component: VideosWatchComponent
  },
  {
    path: '/videos/add',
    name: 'VideosAdd',
    component: VideosAddComponent
  }
])

@Component({
    selector: 'my-app',
    templateUrl: 'app/angular/app/app.component.html',
    styleUrls: [ 'app/angular/app/app.component.css' ],
    directives: [ ROUTER_DIRECTIVES, SearchComponent ],
    providers: [ ROUTER_PROVIDERS, HTTP_PROVIDERS, VideosService, FriendsService, AuthService ]
})

export class AppComponent {
  isLoggedIn: boolean;
  search_field: string = name;
  choices = [  ];

  constructor(private _friendsService: FriendsService,
              private _authService: AuthService,
              private _router: Router
  ) {
    this.isLoggedIn = this._authService.isLoggedIn();

    this._authService.loginChanged$.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true;
        }
      }
    );
  }

  onSearch(search: Search) {
    console.log(search);
    if (search.value !== '') {
      this._router.navigate(['VideosList', { search: search.value, field: search.field }]);
    } else {
      this._router.navigate(['VideosList']);
    }
  }

  logout() {
    // this._authService.logout();
  }

  makeFriends() {
    this._friendsService.makeFriends().subscribe(
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
    this._friendsService.quitFriends().subscribe(
      status => {
          alert('Quit friends!');
      },
      error => alert(error)
    );
  }
}
