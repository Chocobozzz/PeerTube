import { Component, ElementRef } from 'angular2/core';
import { RouteConfig, ROUTER_DIRECTIVES, ROUTER_PROVIDERS, Router } from 'angular2/router';
import { HTTP_PROVIDERS } from 'angular2/http';

import { VideosAddComponent } from '../videos/components/add/videos-add.component';
import { VideosListComponent } from '../videos/components/list/videos-list.component';
import { VideosWatchComponent } from '../videos/components/watch/videos-watch.component';
import { VideosService } from '../videos/services/videos.service';
import { FriendsService } from '../friends/services/friends.service';

@RouteConfig([
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
    directives: [ ROUTER_DIRECTIVES ],
    providers: [ ROUTER_PROVIDERS, HTTP_PROVIDERS, ElementRef, VideosService, FriendsService ]
})

export class AppComponent {
  constructor(private _friendsService: FriendsService, private _router: Router) {}

  doSearch(search: string) {
    if (search !== '') {
      this._router.navigate(['VideosList', { search: search }]);
    } else {
      this._router.navigate(['VideosList']);
    }
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
    )
  }

  quitFriends() {
    this._friendsService.quitFriends().subscribe(
      status => {
          alert('Quit friends!');
      },
      error => alert(error)
    )
  }
}
