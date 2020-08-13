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
import { isLastMonth, isLastWeek, isThisMonth, isToday, isYesterday } from '@shared/core-utils/miscs/date'
import { ServerConfig, UserRight, VideoFilter, VideoSortField } from '@shared/models'
import { NSFWPolicyType } from '@shared/models/videos/nsfw-policy.type'
import { Syndication, Video } from '../shared-main'
import { MiniatureDisplayOptions, OwnerDisplayType } from './video-miniature.component'

enum GroupDate {
  UNKNOWN = 0,
  TODAY = 1,
  YESTERDAY = 2,
  THIS_WEEK = 3,
  THIS_MONTH = 4,
  LAST_MONTH = 5,
  OLDER = 6
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
    iconName: GlobalIconName
    label: string
    justIcon?: boolean
    routerLink?: string
    click?: Function
    clipboard?: string
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
      [GroupDate.TODAY]: $localize`Today`,
      [GroupDate.YESTERDAY]: $localize`Yesterday`,
      [GroupDate.THIS_WEEK]: $localize`This week`,
      [GroupDate.THIS_MONTH]: $localize`This month`,
      [GroupDate.LAST_MONTH]: $localize`Last month`,
      [GroupDate.OLDER]: $localize`Older`
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
        const message = $localize`Cannot load more videos. Try again later.`

        console.error(message, { error })
        this.notifier.error(message)
      }
    )
  }

  reloadVideos () {
    this.pagination.currentPage = 1
    this.loadMoreVideos(true)
  }

  removeVideoFromArray (video: Video) {
    this.videos = this.videos.filter(v => v.id !== video.id)
  }

  buildGroupedDateLabels () {
    let currentGroupedDate: GroupDate = GroupDate.UNKNOWN

    const periods = [
      {
        value: GroupDate.TODAY,
        validator: (d: Date) => isToday(d)
      },
      {
        value: GroupDate.YESTERDAY,
        validator: (d: Date) => isYesterday(d)
      },
      {
        value: GroupDate.THIS_WEEK,
        validator: (d: Date) => isLastWeek(d)
      },
      {
        value: GroupDate.THIS_MONTH,
        validator: (d: Date) => isThisMonth(d)
      },
      {
        value: GroupDate.LAST_MONTH,
        validator: (d: Date) => isLastMonth(d)
      },
      {
        value: GroupDate.OLDER,
        validator: () => true
      }
    ]

    for (const video of this.videos) {
      const publishedDate = video.publishedAt

      for (let i = 0; i < periods.length; i++) {
        const period = periods[i]

        if (currentGroupedDate <= period.value && period.validator(publishedDate)) {

          if (currentGroupedDate !== period.value) {
            currentGroupedDate = period.value
            this.groupedDates[ video.id ] = currentGroupedDate
          }

          break
        }
      }
    }
  }

  getCurrentGroupedDateLabel (video: Video) {
    if (this.groupByDate === false) return undefined

    return this.groupedDateLabels[this.groupedDates[video.id]]
  }

  toggleModerationDisplay () {
    throw new Error('toggleModerationDisplay is not implemented')
  }

  // On videos hook for children that want to do something
  protected onMoreVideos () { /* empty */ }

  protected loadRouteParams (routeParams: { [ key: string ]: any }) {
    this.sort = routeParams[ 'sort' ] as VideoSortField || this.defaultSort
    this.categoryOneOf = routeParams[ 'categoryOneOf' ]
    this.angularState = routeParams[ 'a-state' ]
  }

  protected buildLocalFilter (existing: VideoFilter, base: VideoFilter) {
    if (base === 'local') {
      return existing === 'local'
        ? 'all-local' as 'all-local'
        : 'local' as 'local'
    }

    return existing === 'all'
      ? null
      : 'all'
  }

  protected enableAllFilterIfPossible () {
    if (!this.authService.isLoggedIn()) return

    this.authService.userInformationLoaded
      .subscribe(() => {
        const user = this.authService.getUser()
        this.displayModerationBlock = user.hasRight(UserRight.SEE_ALL_VIDEOS)
      })
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
