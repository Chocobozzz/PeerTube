import { Component, OnInit } from '@angular/core';
import { ROUTER_DIRECTIVES, RouteParams, Router } from '@angular/router-deprecated';

import { PAGINATION_DIRECTIVES } from 'ng2-bootstrap/components/pagination';

import { AuthService } from '../../../users/services/auth.service';
import { Pagination } from '../../pagination';
import { User } from '../../../users/models/user';
import { VideosService } from '../../videos.service';
import { Video } from '../../video';
import { VideoMiniatureComponent } from './video-miniature.component';
import { Search, SearchField } from '../../../app/search';
import { VideoSortComponent } from './video-sort.component';
import { SortField } from './sort';

@Component({
  selector: 'my-videos-list',
  styleUrls: [ 'app/angular/videos/components/list/videos-list.component.css' ],
  templateUrl: 'app/angular/videos/components/list/videos-list.component.html',
  directives: [ ROUTER_DIRECTIVES, PAGINATION_DIRECTIVES, VideoMiniatureComponent, VideoSortComponent ]
})

export class VideosListComponent implements OnInit {
  user: User = null;
  videos: Video[] = [];
  pagination: Pagination = {
    currentPage: 1,
    itemsPerPage: 9,
    total: 0
  };
  sort: SortField;

  private search: Search;

  constructor(
    private _authService: AuthService,
    private _videosService: VideosService,
    private _routeParams: RouteParams,
    private _router: Router
  ) {
    this.search = {
      value: this._routeParams.get('search'),
      field: <SearchField>this._routeParams.get('field')
    };

    this.sort = <SortField>this._routeParams.get('sort') || '-createdDate';
  }

  ngOnInit() {
    if (this._authService.isLoggedIn()) {
      this.user = User.load();
    }

    this.getVideos();
  }

  getVideos() {
    let observable = null;

    if (this.search.value !== null) {
      observable = this._videosService.searchVideos(this.search, this.pagination, this.sort);
    } else {
      observable = this._videosService.getVideos(this.pagination, this.sort);
    }

    observable.subscribe(
      ({ videos, totalVideos }) => {
        this.videos = videos;
        this.pagination.total = totalVideos;
      },
      error => alert(error)
    );
  }

  onRemoved(video: Video): void {
    this.videos.splice(this.videos.indexOf(video), 1);
  }

  onSort(sort: SortField) {
    this.sort = sort;

    const params: any = {
      sort: this.sort
    };

    if (this.search.value) {
      params.search = this.search.value;
      params.field = this.search.field;
    }

    this._router.navigate(['VideosList', params]);
    this.getVideos();
  }
}
