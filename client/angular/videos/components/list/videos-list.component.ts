import { Component, OnInit } from 'angular2/core';
import { ROUTER_DIRECTIVES, RouteParams } from 'angular2/router';

import { AuthService } from '../../../users/services/auth.service';
import { User } from '../../../users/models/user';
import { VideosService } from '../../services/videos.service';
import { Video } from '../../models/video';

@Component({
  selector: 'my-videos-list',
  styleUrls: [ 'app/angular/videos/components/list/videos-list.component.css' ],
  templateUrl: 'app/angular/videos/components/list/videos-list.component.html',
  directives: [ ROUTER_DIRECTIVES ]
})

export class VideosListComponent implements OnInit {
  user: User = null;
  videos: Video[] = [];

  private search: string;

  constructor(
    private _authService: AuthService,
    private _videosService: VideosService,
    routeParams: RouteParams
  ) {
    this.search = routeParams.get('search');
  }

  ngOnInit() {
    if (this._authService.isLoggedIn()) {
      this.user = User.load();
    }

    this.getVideos();
  }

  getVideos() {
    let observable = null;

    if (this.search !== null) {
      observable = this._videosService.searchVideos(this.search);
    } else {
      observable = this._videosService.getVideos();
    }

    observable.subscribe(
      videos => this.videos = videos,
      error => alert(error)
    );
  }

  removeVideo(id: string) {
    this._videosService.removeVideo(id).subscribe(
      status => this.getVideos(),
      error => alert(error)
    );
  }

}
