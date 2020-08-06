import { fromEvent, Observable, Subject, Subscription } from 'rxjs'
import { debounceTime, switchMap, tap } from 'rxjs/operators'
import { Directive, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import {
  AuthService,
  ComponentPaginationLight,
  LocalStorageService,
  Notifier,
  ScreenService,
  ServerService,
  User,
  UserService
} from '@app/core'
import { DisableForReuseHook } from '@app/core/routing/disable-for-reuse-hook'
import { GlobalIconName } from '@app/shared/shared-icons'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { isLastMonth, isLastWeek, isToday, isYesterday } from '@shared/core-utils/miscs/date'
import { ServerConfig, VideoSortField } from '@shared/models'
import { NSFWPolicyType } from '@shared/models/videos/nsfw-policy.type'
import { Syndication, Video } from '../shared-main'
import { MiniatureDisplayOptions, OwnerDisplayType } from './video-miniature.component'

enum GroupDate {
  UNKNOWN = 0,
  TODAY = 1,
  YESTERDAY = 2,
  LAST_WEEK = 3,
  LAST_MONTH = 4,
  OLDER = 5
}

@Directive()
// tslint:disable-next-line: directive-class-suffix
export abstract class AbstractVideoList implements OnInit, OnDestroy, DisableForReuseHook {
  pagination: ComponentPaginationLight = {
    currentPage: 1,
    itemsPerPage: 25
  }
  sort: VideoSortField = '-publishedAt'

  categoryOneOf?: number[]
  languageOneOf?: string[]
  nsfwPolicy?: NSFWPolicyType
  defaultSort: VideoSortField = '-publishedAt'

  syndicationItems: Syndication[] = []

  loadOnInit = true
  useUserVideoPreferences = false
  ownerDisplayType: OwnerDisplayType = 'account'
  displayModerationBlock = false
  titleTooltip: string
  displayVideoActions = true
  groupByDate = false

  videos: Video[] = []
  hasDoneFirstQuery = false
  disabled = false

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: false,
    privacyLabel: true,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  actions: {
    routerLink: string
    iconName: GlobalIconName
    label: string
  }[] = []

  onDataSubject = new Subject<any[]>()

  userMiniature: User

  protected serverConfig: ServerConfig

  protected abstract notifier: Notifier
  protected abstract authService: AuthService
  protected abstract userService: UserService
  protected abstract route: ActivatedRoute
  protected abstract serverService: ServerService
  protected abstract screenService: ScreenService
  protected abstract storageService: LocalStorageService
  protected abstract router: Router
  protected abstract i18n: I18n
  abstract titlePage: string

  private resizeSubscription: Subscription
  private angularState: number

  private groupedDateLabels: { [id in GroupDate]: string }
  private groupedDates: { [id: number]: GroupDate } = {}

  private lastQueryLength: number

  abstract getVideosObservable (page: number): Observable<{ data: Video[] }>

  abstract generateSyndicationList (): void

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)

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

    const loadUserObservable = this.loadUserAndSettings()

    if (this.loadOnInit === true) {
      loadUserObservable.subscribe(() => this.loadMoreVideos())
    }

    this.userService.listenAnonymousUpdate()
      .pipe(switchMap(() => this.loadUserAndSettings()))
      .subscribe(() => {
        if (this.hasDoneFirstQuery) this.reloadVideos()
      })

    // Display avatar in mobile view
    if (this.screenService.isInMobileView()) {
      this.displayOptions.avatar = true
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

    // No more results
    if (this.lastQueryLength !== undefined && this.lastQueryLength < this.pagination.itemsPerPage) return

    this.pagination.currentPage += 1

    this.setScrollRouteParams()

    this.loadMoreVideos()
  }

  loadMoreVideos (reset = false) {
    this.getVideosObservable(this.pagination.currentPage).subscribe(
      ({ data }) => {
        this.hasDoneFirstQuery = true
        this.lastQueryLength = data.length

        if (reset) this.videos = []
        this.videos = this.videos.concat(data)

        if (this.groupByDate) this.buildGroupedDateLabels()

        this.onMoreVideos()

        this.onDataSubject.next(data)
      },

      error => {
        const message = this.i18n('Cannot load more videos. Try again later.')

        console.error(message, { error })
        this.notifier.error(message)
      }
    )
  }

  reloadVideos () {
    this.pagination.currentPage = 1
    this.loadMoreVideos(true)
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
    if (!path || path === '/') path = this.serverConfig.instance.defaultClientRoute

    this.router.navigate([ path ], { queryParams, replaceUrl: true, queryParamsHandling: 'merge' })
  }

  private loadUserAndSettings () {
    return this.userService.getAnonymousOrLoggedUser()
      .pipe(tap(user => {
        this.userMiniature = user

        if (!this.useUserVideoPreferences) return

        this.languageOneOf = user.videoLanguages
        this.nsfwPolicy = user.nsfwPolicy
      }))
  }
}
