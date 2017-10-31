import { OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Subscription } from 'rxjs/Subscription'
import { BehaviorSubject } from 'rxjs/BehaviorSubject'
import { Observable } from 'rxjs/Observable'

import { NotificationsService } from 'angular2-notifications'

import {
  SortField,
  Video,
  VideoPagination
} from '../../shared'

export abstract class AbstractVideoList implements OnInit, OnDestroy {
  loading: BehaviorSubject<boolean> = new BehaviorSubject(false)
  pagination: VideoPagination = {
    currentPage: 1,
    itemsPerPage: 25,
    totalItems: null
  }
  sort: SortField
  videos: Video[] = []

  protected notificationsService: NotificationsService
  protected router: Router
  protected route: ActivatedRoute

  protected subActivatedRoute: Subscription

  abstract getVideosObservable (): Observable<{ videos: Video[], totalVideos: number}>

  ngOnInit () {
    // Subscribe to route changes
    this.subActivatedRoute = this.route.params.subscribe(routeParams => {
      this.loadRouteParams(routeParams)

      this.getVideos()
    })
  }

  ngOnDestroy () {
    this.subActivatedRoute.unsubscribe()
  }

  getVideos () {
    this.loading.next(true)
    this.videos = []

    const observable = this.getVideosObservable()

    observable.subscribe(
      ({ videos, totalVideos }) => {
        this.videos = videos
        this.pagination.totalItems = totalVideos

        this.loading.next(false)
      },
      error => this.notificationsService.error('Error', error.text)
    )
  }

  isThereNoVideo () {
    return !this.loading.getValue() && this.videos.length === 0
  }

  onPageChanged (event: { page: number }) {
    // Be sure the current page is set
    this.pagination.currentPage = event.page

    this.navigateToNewParams()
  }

  onSort (sort: SortField) {
    this.sort = sort

    this.navigateToNewParams()
  }

  protected buildRouteParams () {
    // There is always a sort and a current page
    const params = {
      sort: this.sort,
      page: this.pagination.currentPage
    }

    return params
  }

  protected loadRouteParams (routeParams: { [ key: string ]: any }) {
    this.sort = routeParams['sort'] as SortField || '-createdAt'

    if (routeParams['page'] !== undefined) {
      this.pagination.currentPage = parseInt(routeParams['page'], 10)
    } else {
      this.pagination.currentPage = 1
    }
  }

  protected navigateToNewParams () {
    const routeParams = this.buildRouteParams()
    this.router.navigate([ '/videos/list', routeParams ])
  }
}
