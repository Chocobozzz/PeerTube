import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, ROUTER_DIRECTIVES } from '@angular/router';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

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
  pipes: [ AsyncPipe ],
  template: require('./video-list.component.html'),
  directives: [ LoaderComponent, PAGINATION_DIRECTIVES, ROUTER_DIRECTIVES, VideoMiniatureComponent, VideoSortComponent ]
})

export class VideoListComponent implements OnInit, OnDestroy {
  loading: BehaviorSubject<boolean> = new BehaviorSubject(false);
  pagination: Pagination = {
    currentPage: 1,
    itemsPerPage: 9,
    totalItems: null
  };
  sort: SortField;
  user: User = null;
  videos: Video[] = [];

  private search: Search;
  private sub: any;

  constructor(
    private authService: AuthService,
    private changeDetector: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private videoService: VideoService,
    private searchService: SearchService
  ) {}

  ngOnInit() {
    this.sub = this.route.params.subscribe(routeParams => {
      if (this.authService.isLoggedIn()) {
        this.user = User.load();
      }

      this.search = {
        value: routeParams['search'],
        field: <SearchField>routeParams['field']
      };

      // Update the search service component
      this.searchService.searchChanged.next(this.search);

      this.sort = <SortField>routeParams['sort'] || '-createdDate';

      this.getVideos();
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  getVideos(detectChanges = true) {
    this.loading.next(true);
    this.videos = [];
    this.pagination.currentPage = 1;

    this.changeDetector.detectChanges();

    let observable = null;

    if (this.search.value) {
      observable = this.videoService.searchVideos(this.search, this.pagination, this.sort);
    } else {
      observable = this.videoService.getVideos(this.pagination, this.sort);
    }

    observable.subscribe(
      ({ videos, totalVideos }) => {
        this.videos = videos;
        this.pagination.totalItems = totalVideos;

        this.loading.next(false);
      },
      error => alert(error)
    );
  }

  noVideo() {
    return !this.loading && this.videos.length === 0;
  }

  onRemoved(video: Video) {
    this.getVideos(false);
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
}
