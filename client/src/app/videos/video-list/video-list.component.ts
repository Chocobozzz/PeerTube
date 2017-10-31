import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Subscription } from 'rxjs/Subscription'

import { NotificationsService } from 'angular2-notifications'

import { VideoService } from '../shared'
import { Search, SearchField, SearchService } from '../../shared'
import { AbstractVideoList } from './shared'

@Component({
  selector: 'my-videos-list',
  styleUrls: [ './shared/abstract-video-list.scss' ],
  templateUrl: './shared/abstract-video-list.html'
})
export class VideoListComponent extends AbstractVideoList implements OnInit, OnDestroy {
  private search: Search
  private subSearch: Subscription

  constructor (
    protected router: Router,
    protected route: ActivatedRoute,
    protected notificationsService: NotificationsService,
    private videoService: VideoService,
    private searchService: SearchService
  ) {
    super()
  }

  ngOnInit () {
    // Subscribe to route changes
    this.subActivatedRoute = this.route.params.subscribe(routeParams => {
      this.loadRouteParams(routeParams)

      // Update the search service component
      this.searchService.updateSearch.next(this.search)
      this.getVideos()
    })

    // Subscribe to search changes
    this.subSearch = this.searchService.searchUpdated.subscribe(search => {
      this.search = search
      // Reset pagination
      this.pagination.currentPage = 1

      this.navigateToNewParams()
    })
  }

  ngOnDestroy () {
    super.ngOnDestroy()

    this.subSearch.unsubscribe()
  }

  getVideosObservable () {
    let observable = null
    if (this.search.value) {
      observable = this.videoService.searchVideos(this.search, this.pagination, this.sort)
    } else {
      observable = this.videoService.getVideos(this.pagination, this.sort)
    }

    return observable
  }

  protected buildRouteParams () {
    const params = super.buildRouteParams()

    // Maybe there is a search
    if (this.search.value) {
      params['field'] = this.search.field
      params['search'] = this.search.value
    }

    return params
  }

  protected loadRouteParams (routeParams: { [ key: string ]: any }) {
    super.loadRouteParams(routeParams)

    if (routeParams['search'] !== undefined) {
      this.search = {
        value: routeParams['search'],
        field: routeParams['field'] as SearchField
      }
    } else {
      this.search = {
        value: '',
        field: 'name'
      }
    }
  }
}
