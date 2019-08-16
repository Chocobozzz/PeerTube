import { debounceTime, first, tap } from 'rxjs/operators'
import { OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { fromEvent, Observable, of, Subject, Subscription } from 'rxjs'
import { AuthService } from '../../core/auth'
import { ComponentPagination } from '../rest/component-pagination.model'
import { VideoSortField } from './sort-field.type'
import { Video } from './video.model'
import { ScreenService } from '@app/shared/misc/screen.service'
import { MiniatureDisplayOptions, OwnerDisplayType } from '@app/shared/video/video-miniature.component'
import { Syndication } from '@app/shared/video/syndication.model'
import { Notifier, ServerService } from '@app/core'
import { DisableForReuseHook } from '@app/core/routing/disable-for-reuse-hook'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { isLastMonth, isLastWeek, isToday, isYesterday } from '@shared/core-utils/miscs/date'
import { ResultList } from '@shared/models'

enum GroupDate {
  UNKNOWN = 0,
  TODAY = 1,
  YESTERDAY = 2,
  LAST_WEEK = 3,
  LAST_MONTH = 4,
  OLDER = 5
}

export abstract class AbstractVideoList implements OnInit, OnDestroy, DisableForReuseHook {
  pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 25,
    totalItems: null
  }
  sort: VideoSortField = '-publishedAt'

  categoryOneOf?: number
  languageOneOf?: string[]
  defaultSort: VideoSortField = '-publishedAt'

  syndicationItems: Syndication[] = []

  loadOnInit = true
  useUserVideoLanguagePreferences = false
  ownerDisplayType: OwnerDisplayType = 'account'
  displayModerationBlock = false
  titleTooltip: string
  displayVideoActions = true
  groupByDate = false

  videos: Video[] = []
  disabled = false

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    privacyLabel: true,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  onDataSubject = new Subject<any[]>()

  protected abstract notifier: Notifier
  protected abstract authService: AuthService
  protected abstract route: ActivatedRoute
  protected abstract serverService: ServerService
  protected abstract screenService: ScreenService
  protected abstract router: Router
  protected abstract i18n: I18n
  abstract titlePage: string

  private resizeSubscription: Subscription
  private angularState: number

  private groupedDateLabels: { [id in GroupDate]: string }
  private groupedDates: { [id: number]: GroupDate } = {}

  abstract getVideosObservable (page: number): Observable<ResultList<Video>>

  abstract generateSyndicationList (): void

  get user () {
    return this.authService.getUser()
  }

  ngOnInit () {
    this.groupedDateLabels = {
      [GroupDate.UNKNOWN]: null,
      [GroupDate.TODAY]: this.i18n('Today'),
      [GroupDate.YESTERDAY]: this.i18n('Yesterday'),
      [GroupDate.LAST_WEEK]: this.i18n('Last week'),
      [GroupDate.LAST_MONTH]: this.i18n('Last month'),
      [GroupDate.OLDER]: this.i18n('Older')
    }

    // Subscribe to route changes
    const routeParams = this.route.snapshot.queryParams
    this.loadRouteParams(routeParams)

    this.resizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(500))
      .subscribe(() => this.calcPageSizes())

    this.calcPageSizes()

    const loadUserObservable = this.loadUserVideoLanguagesIfNeeded()

    if (this.loadOnInit === true) {
      loadUserObservable.subscribe(() => this.loadMoreVideos())
    }
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
    this.getVideosObservable(this.pagination.currentPage).subscribe(
      ({ data, total }) => {
        this.pagination.totalItems = total
        this.videos = this.videos.concat(data)

        if (this.groupByDate) this.buildGroupedDateLabels()

        this.onMoreVideos()

        this.onDataSubject.next(data)
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

  removeVideoFromArray (video: Video) {
    this.videos = this.videos.filter(v => v.id !== video.id)
  }

  buildGroupedDateLabels () {
    let currentGroupedDate: GroupDate = GroupDate.UNKNOWN

    for (const video of this.videos) {
      const publishedDate = video.publishedAt

      if (currentGroupedDate <= GroupDate.TODAY && isToday(publishedDate)) {
        if (currentGroupedDate === GroupDate.TODAY) continue

        currentGroupedDate = GroupDate.TODAY
        this.groupedDates[ video.id ] = currentGroupedDate
        continue
      }

      if (currentGroupedDate <= GroupDate.YESTERDAY && isYesterday(publishedDate)) {
        if (currentGroupedDate === GroupDate.YESTERDAY) continue

        currentGroupedDate = GroupDate.YESTERDAY
        this.groupedDates[ video.id ] = currentGroupedDate
        continue
      }

      if (currentGroupedDate <= GroupDate.LAST_WEEK && isLastWeek(publishedDate)) {
        if (currentGroupedDate === GroupDate.LAST_WEEK) continue

        currentGroupedDate = GroupDate.LAST_WEEK
        this.groupedDates[ video.id ] = currentGroupedDate
        continue
      }

      if (currentGroupedDate <= GroupDate.LAST_MONTH && isLastMonth(publishedDate)) {
        if (currentGroupedDate === GroupDate.LAST_MONTH) continue

        currentGroupedDate = GroupDate.LAST_MONTH
        this.groupedDates[ video.id ] = currentGroupedDate
        continue
      }

      if (currentGroupedDate <= GroupDate.OLDER) {
        if (currentGroupedDate === GroupDate.OLDER) continue

        currentGroupedDate = GroupDate.OLDER
        this.groupedDates[ video.id ] = currentGroupedDate
      }
    }
  }

  getCurrentGroupedDateLabel (video: Video) {
    if (this.groupByDate === false) return undefined

    return this.groupedDateLabels[this.groupedDates[video.id]]
  }

  // On videos hook for children that want to do something
  protected onMoreVideos () { /* empty */ }

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

  private loadUserVideoLanguagesIfNeeded () {
    if (!this.authService.isLoggedIn() || !this.useUserVideoLanguagePreferences) {
      return of(true)
    }

    return this.authService.userInformationLoaded
        .pipe(
          first(),
          tap(() => this.languageOneOf = this.user.videoLanguages)
        )
  }
}
