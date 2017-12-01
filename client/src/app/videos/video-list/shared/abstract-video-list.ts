import { OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'
import { Observable } from 'rxjs/Observable'
import { Subscription } from 'rxjs/Subscription'

import { SortField, Video, VideoPagination } from '../../shared'

export abstract class AbstractVideoList implements OnInit, OnDestroy {
  pagination: VideoPagination = {
    currentPage: 1,
    itemsPerPage: 25,
    totalItems: null
  }
  sort: SortField = '-createdAt'
  videos: Video[] = []

  protected notificationsService: NotificationsService
  protected router: Router
  protected route: ActivatedRoute
  protected subActivatedRoute: Subscription

  protected abstract currentRoute: string

  abstract titlePage: string
  private loadedPages: { [ id: number ]: boolean } = {}

  abstract getVideosObservable (): Observable<{ videos: Video[], totalVideos: number}>

  ngOnInit () {
    // Subscribe to route changes
    const routeParams = this.route.snapshot.params
    this.loadRouteParams(routeParams)
    this.loadMoreVideos('after')
  }

  ngOnDestroy () {
    if (this.subActivatedRoute) {
      this.subActivatedRoute.unsubscribe()
    }
  }

  onNearOfTop () {
    if (this.pagination.currentPage > 1) {
      this.previousPage()
    }
  }

  onNearOfBottom () {
    if (this.hasMoreVideos()) {
      this.nextPage()
    }
  }

  loadMoreVideos (where: 'before' | 'after') {
    if (this.loadedPages[this.pagination.currentPage] === true) return

    const observable = this.getVideosObservable()

    observable.subscribe(
      ({ videos, totalVideos }) => {
        this.loadedPages[this.pagination.currentPage] = true
        this.pagination.totalItems = totalVideos

        if (where === 'before') {
          this.videos = videos.concat(this.videos)
        } else {
          this.videos = this.videos.concat(videos)
        }
      },
      error => this.notificationsService.error('Error', error.text)
    )
  }

  protected hasMoreVideos () {
    if (!this.pagination.totalItems) return true

    const maxPage = this.pagination.totalItems/this.pagination.itemsPerPage
    return maxPage > this.pagination.currentPage
  }

  protected previousPage () {
    this.pagination.currentPage--

    this.setNewRouteParams()
    this.loadMoreVideos('before')
  }

  protected nextPage () {
    this.pagination.currentPage++

    this.setNewRouteParams()
    this.loadMoreVideos('after')
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

  protected setNewRouteParams () {
    const routeParams = this.buildRouteParams()
    this.router.navigate([ this.currentRoute, routeParams ])
  }
}
