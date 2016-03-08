import {Component} from 'angular2/core';
import { RouteConfig, ROUTER_DIRECTIVES, ROUTER_PROVIDERS } from 'angular2/router';

import { VideosAddComponent } from '../videos/add/videos-add.component';
import { VideosListComponent } from '../videos/list/videos-list.component';
import { VideosWatchComponent } from '../videos/watch/videos-watch.component';

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
    templateUrl: 'app/components/app/app.component.html',
    styleUrls: [ 'app/components/app/app.component.css' ],
    directives: [ ROUTER_DIRECTIVES ],
    providers: [ ROUTER_PROVIDERS ]
})

export class AppComponent {
  makeFriends() {
    alert('make Friends');
  }

  quitFriends() {
    alert('quit Friends');
  }
}
