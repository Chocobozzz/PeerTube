import { ElementRef, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { isInMobileView } from '@app/shared/misc/utils'
import { InfiniteScrollerDirective } from '@app/shared/video/infinite-scroller.directive'
import { NotificationsService } from 'angular2-notifications'
import { Observable } from 'rxjs/Observable'
import { fromEvent } from 'rxjs/observable/fromEvent'
import { AuthService } from '../../core/auth'
import { ComponentPagination } from '../rest/component-pagination.model'
import { SortField } from './sort-field.type'
import { Video } from './video.model'

export abstract class AbstractVideoList implements OnInit {
  private static LINES_PER_PAGE = 3

  @ViewChild('videoElement') videosElement: ElementRef
  @ViewChild(InfiniteScrollerDirective) infiniteScroller: InfiniteScrollerDirective

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  sort: SortField = '-createdAt'
  defaultSort: SortField = '-createdAt'
  loadOnInit = true
  pageHeight: number
  videoWidth = 215
  videoHeight = 230
  videoPages: Video[][]

  protected abstract notificationsService: NotificationsService
  protected abstract authService: AuthService
  protected abstract router: Router
  protected abstract route: ActivatedRoute
  protected abstract currentRoute: string
  abstract titlePage: string

  protected loadedPages: { [ id: number ]: Video[] } = {}
  protected otherRouteParams = {}

  abstract getVideosObservable (page: number): Observable<{ videos: Video[], totalVideos: number}>

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    // Subscribe to route changes
    const routeParams = this.route.snapshot.params
    this.loadRouteParams(routeParams)

    fromEvent(window, 'resize')
      .debounceTime(500)
      .subscribe(() => this.calcPageSizes())

    this.calcPageSizes()
    if (this.loadOnInit === true) this.loadMoreVideos(this.pagination.currentPage)
  }

  onNearOfTop () {
    this.previousPage()
  }

  onNearOfBottom () {
    if (this.hasMoreVideos()) {
      this.nextPage()
    }
  }

  onPageChanged (page: number) {
    this.pagination.currentPage = page
    this.setNewRouteParams()
  }

  reloadVideos () {
    this.loadedPages = {}
    this.loadMoreVideos(this.pagination.currentPage)
  }

  loadMoreVideos (page: number) {
    if (this.loadedPages[page] !== undefined) return

    const observable = this.getVideosObservable(page)

    observable.subscribe(
      ({ videos, totalVideos }) => {
        // Paging is too high, return to the first one
        if (this.pagination.currentPage > 1 && totalVideos <= ((this.pagination.currentPage - 1) * this.pagination.itemsPerPage)) {
          this.pagination.currentPage = 1
          this.setNewRouteParams()
          return this.reloadVideos()
        }

        this.loadedPages[page] = videos
        this.buildVideoPages()
        this.pagination.totalItems = totalVideos

        // Initialize infinite scroller now we loaded the first page
        if (Object.keys(this.loadedPages).length === 1) {
          // Wait elements creation
          setTimeout(() => this.infiniteScroller.initialize(), 500)
        }
      },
      error => this.notificationsService.error('Error', error.message)
    )
  }

  protected hasMoreVideos () {
    // No results
    if (this.pagination.totalItems === 0) return false

    // Not loaded yet
    if (!this.pagination.totalItems) return true

    const maxPage = this.pagination.totalItems / this.pagination.itemsPerPage
    return maxPage > this.maxPageLoaded()
  }

  protected previousPage () {
    const min = this.minPageLoaded()

    if (min > 1) {
      this.loadMoreVideos(min - 1)
    }
  }

  protected nextPage () {
    this.loadMoreVideos(this.maxPageLoaded() + 1)
  }

  protected buildRouteParams () {
    // There is always a sort and a current page
    const params = {
      sort: this.sort,
      page: this.pagination.currentPage
    }

    return Object.assign(params, this.otherRouteParams)
  }

  protected loadRouteParams (routeParams: { [ key: string ]: any }) {
    this.sort = routeParams['sort'] as SortField || this.defaultSort

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

  protected buildVideoPages () {
    this.videoPages = Object.values(this.loadedPages)
  }

  private minPageLoaded () {
    return Math.min(...Object.keys(this.loadedPages).map(e => parseInt(e, 10)))
  }

  private maxPageLoaded () {
    return Math.max(...Object.keys(this.loadedPages).map(e => parseInt(e, 10)))
  }

  private calcPageSizes () {
    if (isInMobileView()) {
      this.pagination.itemsPerPage = 5

      // Video takes all the width
      this.videoWidth = -1
      this.pageHeight = this.pagination.itemsPerPage * this.videoHeight
    } else {
      const videosWidth = this.videosElement.nativeElement.offsetWidth
      this.pagination.itemsPerPage = Math.floor(videosWidth / this.videoWidth) * AbstractVideoList.LINES_PER_PAGE
      this.pageHeight = this.videoHeight * AbstractVideoList.LINES_PER_PAGE
    }

    // Rebuild pages because maybe we modified the number of items per page
    let videos: Video[] = []
    Object.values(this.loadedPages)
      .forEach(videosPage => videos = videos.concat(videosPage))
    this.loadedPages = {}

    for (let i = 1; (i * this.pagination.itemsPerPage) <= videos.length; i++) {
      this.loadedPages[i] = videos.slice((i - 1) * this.pagination.itemsPerPage, this.pagination.itemsPerPage * i)
    }

    this.buildVideoPages()

    console.log('Re calculated pages after a resize!')
  }
}
