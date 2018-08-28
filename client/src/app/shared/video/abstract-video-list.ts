import { debounceTime } from 'rxjs/operators'
import { ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { InfiniteScrollerDirective } from '@app/shared/video/infinite-scroller.directive'
import { NotificationsService } from 'angular2-notifications'
import { fromEvent, Observable, Subscription } from 'rxjs'
import { AuthService } from '../../core/auth'
import { ComponentPagination } from '../rest/component-pagination.model'
import { VideoSortField } from './sort-field.type'
import { Video } from './video.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ScreenService } from '@app/shared/misc/screen.service'
import { OwnerDisplayType } from '@app/shared/video/video-miniature.component'

export abstract class AbstractVideoList implements OnInit, OnDestroy {
  private static LINES_PER_PAGE = 4

  @ViewChild('videosElement') videosElement: ElementRef
  @ViewChild(InfiniteScrollerDirective) infiniteScroller: InfiniteScrollerDirective

  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: null
  }
  sort: VideoSortField = '-publishedAt'
  categoryOneOf?: number
  defaultSort: VideoSortField = '-publishedAt'
  syndicationItems = []

  loadOnInit = true
  marginContent = true
  pageHeight: number
  videoWidth: number
  videoHeight: number
  videoPages: Video[][] = []
  ownerDisplayType: OwnerDisplayType = 'account'

  protected baseVideoWidth = 215
  protected baseVideoHeight = 230

  protected abstract notificationsService: NotificationsService
  protected abstract authService: AuthService
  protected abstract router: Router
  protected abstract route: ActivatedRoute
  protected abstract screenService: ScreenService
  protected abstract i18n: I18n
  protected abstract location: Location
  protected abstract currentRoute: string
  abstract titlePage: string

  protected loadedPages: { [ id: number ]: Video[] } = {}
  protected loadingPage: { [ id: number ]: boolean } = {}
  protected otherRouteParams = {}

  private resizeSubscription: Subscription

  abstract getVideosObservable (page: number): Observable<{ videos: Video[], totalVideos: number}>
  abstract generateSyndicationList ()

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    // Subscribe to route changes
    const routeParams = this.route.snapshot.queryParams
    this.loadRouteParams(routeParams)

    this.resizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(500))
      .subscribe(() => this.calcPageSizes())

    this.calcPageSizes()
    if (this.loadOnInit === true) this.loadMoreVideos(this.pagination.currentPage)
  }

  ngOnDestroy () {
    if (this.resizeSubscription) this.resizeSubscription.unsubscribe()
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
    if (this.loadingPage[page] === true) return

    this.loadingPage[page] = true
    const observable = this.getVideosObservable(page)

    observable.subscribe(
      ({ videos, totalVideos }) => {
        this.loadingPage[page] = false

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
      error => {
        this.loadingPage[page] = false
        this.notificationsService.error(this.i18n('Error'), error.message)
      }
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
    this.sort = routeParams['sort'] as VideoSortField || this.defaultSort
    this.categoryOneOf = routeParams['categoryOneOf']
    if (routeParams['page'] !== undefined) {
      this.pagination.currentPage = parseInt(routeParams['page'], 10)
    } else {
      this.pagination.currentPage = 1
    }
  }

  protected setNewRouteParams () {
    const paramsObject = this.buildRouteParams()

    const queryParams = Object.keys(paramsObject).map(p => p + '=' + paramsObject[p]).join('&')
    this.location.replaceState(this.currentRoute, queryParams)
  }

  protected buildVideoPages () {
    this.videoPages = Object.values(this.loadedPages)
  }

  protected buildVideoHeight () {
    // Same ratios than base width/height
    return this.videosElement.nativeElement.offsetWidth * (this.baseVideoHeight / this.baseVideoWidth)
  }

  private minPageLoaded () {
    return Math.min(...Object.keys(this.loadedPages).map(e => parseInt(e, 10)))
  }

  private maxPageLoaded () {
    return Math.max(...Object.keys(this.loadedPages).map(e => parseInt(e, 10)))
  }

  private calcPageSizes () {
    if (this.screenService.isInMobileView() || this.baseVideoWidth === -1) {
      this.pagination.itemsPerPage = 5

      // Video takes all the width
      this.videoWidth = -1
      this.videoHeight = this.buildVideoHeight()
      this.pageHeight = this.pagination.itemsPerPage * this.videoHeight
    } else {
      this.videoWidth = this.baseVideoWidth
      this.videoHeight = this.baseVideoHeight

      const videosWidth = this.videosElement.nativeElement.offsetWidth
      this.pagination.itemsPerPage = Math.floor(videosWidth / this.videoWidth) * AbstractVideoList.LINES_PER_PAGE
      this.pageHeight = this.videoHeight * AbstractVideoList.LINES_PER_PAGE
    }

    // Rebuild pages because maybe we modified the number of items per page
    const videos = [].concat(...this.videoPages)
    this.loadedPages = {}

    let i = 1
    // Don't include the last page if it not complete
    while (videos.length >= this.pagination.itemsPerPage && i < 10000) { // 10000 -> Hard limit in case of infinite loop
      this.loadedPages[i] = videos.splice(0, this.pagination.itemsPerPage)
      i++
    }

    // Re fetch the last page
    if (videos.length !== 0) {
      this.loadMoreVideos(i)
    } else {
      this.buildVideoPages()
    }

    console.log('Rebuilt pages with %s elements per page.', this.pagination.itemsPerPage)
  }
}
