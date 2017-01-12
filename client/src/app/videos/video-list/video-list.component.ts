import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import {
  SortField,
  Video,
  VideoService
} from '../shared';
import { AuthService } from '../../core';
import { AuthUser, RestPagination, Search, SearchField } from '../../shared';
import { SearchService } from '../../shared';

@Component({
  selector: 'my-videos-list',
  styleUrls: [ './video-list.component.scss' ],
  templateUrl: './video-list.component.html'
})

export class VideoListComponent implements OnInit, OnDestroy {
  loading: BehaviorSubject<boolean> = new BehaviorSubject(false);
  pagination: RestPagination = {
    currentPage: 1,
    itemsPerPage: 9,
    totalItems: null
  };
  sort: SortField;
  user: AuthUser = null;
  videos: Video[] = [];

  private search: Search;
  private subActivatedRoute: any;
  private subSearch: any;

  constructor(
    private authService: AuthService,
    private changeDetector: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private videoService: VideoService,
    private searchService: SearchService
  ) {}

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      this.user = AuthUser.load();
    }

    // Subscribe to route changes
    this.subActivatedRoute = this.route.params.subscribe(routeParams => {
      this.loadRouteParams(routeParams);

      // Update the search service component
      this.searchService.updateSearch.next(this.search);
      this.getVideos();
    });

    // Subscribe to search changes
    this.subSearch = this.searchService.searchUpdated.subscribe(search => {
      this.search = search;
      // Reset pagination
      this.pagination.currentPage = 1;

      this.navigateToNewParams();
    });
  }

  ngOnDestroy() {
    this.subActivatedRoute.unsubscribe();
    this.subSearch.unsubscribe();
  }

  getVideos() {
    this.loading.next(true);
    this.videos = [];

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
      error => alert(error.text)
    );
  }

  isThereNoVideo() {
    return !this.loading.getValue() && this.videos.length === 0;
  }

  onPageChanged(event: any) {
    // Be sure the current page is set
    this.pagination.currentPage = event.page;

    this.navigateToNewParams();
  }

  onRemoved(video: Video) {
    this.getVideos();
  }

  onSort(sort: SortField) {
    this.sort = sort;

    this.navigateToNewParams();
  }

  private buildRouteParams() {
    // There is always a sort and a current page
    const params: any = {
      sort: this.sort,
      page: this.pagination.currentPage
    };

    // Maybe there is a search
    if (this.search.value) {
      params.field = this.search.field;
      params.search = this.search.value;
    }

    return params;
  }

  private loadRouteParams(routeParams) {
    if (routeParams['search'] !== undefined) {
      this.search = {
        value: routeParams['search'],
        field: <SearchField>routeParams['field']
      };
    } else {
      this.search = {
        value: '',
        field: 'name'
      };
    }

    this.sort = <SortField>routeParams['sort'] || '-createdAt';

    if (routeParams['page'] !== undefined) {
      this.pagination.currentPage = parseInt(routeParams['page']);
    } else {
      this.pagination.currentPage = 1;
    }

    this.changeDetector.detectChanges();
  }

  private navigateToNewParams() {
    const routeParams = this.buildRouteParams();
    this.router.navigate(['/videos/list', routeParams]);
  }
}
