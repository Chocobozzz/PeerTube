import { Component, OnInit } from '@angular/core';
import { Router, ROUTER_DIRECTIVES, RouteSegment } from '@angular/router';

import { PAGINATION_DIRECTIVES } from 'ng2-bootstrap/components/pagination';

import {
  LoaderComponent,
  Pagination,
  SortField,
  Video,
  VideoService
} from '../shared';
import { AuthService, Search, SearchField, User } from '../../shared';
import { VideoMiniatureComponent } from './video-miniature.component';
import { VideoSortComponent } from './video-sort.component';
import { SearchService } from '../../shared';

@Component({
  selector: 'my-videos-list',
  styles: [ require('./video-list.component.scss') ],
  template: require('./video-list.component.html'),
  directives: [ LoaderComponent, PAGINATION_DIRECTIVES, ROUTER_DIRECTIVES, VideoMiniatureComponent, VideoSortComponent ]
})

export class VideoListComponent implements OnInit {
  loading = false;
  pagination: Pagination = {
    currentPage: 1,
    itemsPerPage: 9,
    total: 0
  };
  sort: SortField;
  user: User = null;
  videos: Video[] = [];

  private search: Search;

  constructor(
    private authService: AuthService,
    private router: Router,
    private routeSegment: RouteSegment,
    private videoService: VideoService,
    private searchService: SearchService // Temporary
  ) {}

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      this.user = User.load();
    }

    this.search = {
      value: this.routeSegment.getParam('search'),
      field: <SearchField>this.routeSegment.getParam('field')
    };

    // Temporary
    this.searchChanged(this.search);

    this.sort = <SortField>this.routeSegment.getParam('sort') || '-createdDate';

    this.getVideos();
  }

  getVideos() {
    this.loading = true;
    this.videos = [];

    let observable = null;

    if (this.search.value) {
      observable = this.videoService.searchVideos(this.search, this.pagination, this.sort);
    } else {
      observable = this.videoService.getVideos(this.pagination, this.sort);
    }

    observable.subscribe(
      ({ videos, totalVideos }) => {
        this.videos = videos;
        this.pagination.total = totalVideos;

        this.loading = false;
      },
      error => alert(error)
    );
  }

  noVideo() {
    return !this.loading && this.videos.length === 0;
  }

  onRemoved(video: Video) {
    this.getVideos();
  }

  onSort(sort: SortField) {
    this.sort = sort;

    const params: any = {
      sort: this.sort
    };

    if (this.search.value) {
      params.field = this.search.field;
      params.search = this.search.value;
    }

    this.router.navigate(['/videos/list', params]);
  }

  searchChanged(search: Search) {
    this.searchService.searchChanged.next(search);
  }
}
