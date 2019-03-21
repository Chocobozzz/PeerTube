import { debounceTime } from 'rxjs/operators'
import { OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { fromEvent, Observable, Subscription } from 'rxjs'
import { AuthService } from '../../core/auth'
import { ComponentPagination } from '../rest/component-pagination.model'
import { VideoSortField } from './sort-field.type'
import { Video } from './video.model'
import { ScreenService } from '@app/shared/misc/screen.service'
import { OwnerDisplayType } from '@app/shared/video/video-miniature.component'
import { Syndication } from '@app/shared/video/syndication.model'
import { Notifier, ServerService } from '@app/core'
import { DisableForReuseHook } from '@app/core/routing/disable-for-reuse-hook'

export abstract class AbstractVideoList implements OnInit, OnDestroy, DisableForReuseHook {
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 25,
    totalItems: null
  }
  sort: VideoSortField = '-publishedAt'

  categoryOneOf?: number
  defaultSort: VideoSortField = '-publishedAt'

  syndicationItems: Syndication[] = []

  loadOnInit = true
  marginContent = true
  videos: Video[] = []
  ownerDisplayType: OwnerDisplayType = 'account'
  displayModerationBlock = false
  titleTooltip: string

  disabled = false

  protected abstract notifier: Notifier
  protected abstract authService: AuthService
  protected abstract route: ActivatedRoute
  protected abstract serverService: ServerService
  protected abstract screenService: ScreenService
  protected abstract router: Router
  abstract titlePage: string

  private resizeSubscription: Subscription
  private angularState: number

  abstract getVideosObservable (page: number): Observable<{ videos: Video[], totalVideos: number }>

  abstract generateSyndicationList (): void

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
    if (this.loadOnInit === true) this.loadMoreVideos()
  }

  ngOnDestroy () {
    if (this.resizeSubscription) this.resizeSubscription.unsubscribe()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = false
  }

  videoById (index: number, video: Video) {
    return video.id
  }

  onNearOfBottom () {
    if (this.disabled) return

    // Last page
    if (this.pagination.totalItems <= (this.pagination.currentPage * this.pagination.itemsPerPage)) return

    this.pagination.currentPage += 1

    this.setScrollRouteParams()

    this.loadMoreVideos()
  }

  loadMoreVideos () {
    const observable = this.getVideosObservable(this.pagination.currentPage)

    observable.subscribe(
      ({ videos, totalVideos }) => {
        this.pagination.totalItems = totalVideos
        this.videos = this.videos.concat(videos)
      },

      error => this.notifier.error(error.message)
    )
  }

  reloadVideos () {
    this.pagination.currentPage = 1
    this.videos = []
    this.loadMoreVideos()
  }

  toggleModerationDisplay () {
    throw new Error('toggleModerationDisplay is not implemented')
  }

  protected loadRouteParams (routeParams: { [ key: string ]: any }) {
    this.sort = routeParams[ 'sort' ] as VideoSortField || this.defaultSort
    this.categoryOneOf = routeParams[ 'categoryOneOf' ]
    this.angularState = routeParams[ 'a-state' ]
  }

  private calcPageSizes () {
    if (this.screenService.isInMobileView()) {
      this.pagination.itemsPerPage = 5
    }
  }

  private setScrollRouteParams () {
    // Already set
    if (this.angularState) return

    this.angularState = 42

    const queryParams = {
      'a-state': this.angularState,
      categoryOneOf: this.categoryOneOf
    }

    let path = this.router.url
    if (!path || path === '/') path = this.serverService.getConfig().instance.defaultClientRoute

    this.router.navigate([ path ], { queryParams, replaceUrl: true, queryParamsHandling: 'merge' })
  }
}
