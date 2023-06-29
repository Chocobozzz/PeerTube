import * as debug from 'debug'
import { fromEvent, Observable, Subject, Subscription } from 'rxjs'
import { concatMap, debounceTime, map, switchMap } from 'rxjs/operators'
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import {
  AuthService,
  ComponentPaginationLight,
  Notifier,
  PeerTubeRouterService,
  ScreenService,
  ServerService,
  User,
  UserService
} from '@app/core'
import { GlobalIconName } from '@app/shared/shared-icons'
import { logger } from '@root-helpers/logger'
import { isLastMonth, isLastWeek, isThisMonth, isToday, isYesterday } from '@shared/core-utils'
import { ResultList, UserRight, VideoSortField } from '@shared/models'
import { Syndication, Video } from '../shared-main'
import { VideoFilters, VideoFilterScope } from './video-filters.model'
import { MiniatureDisplayOptions } from './video-miniature.component'

const debugLogger = debug('peertube:videos:VideosListComponent')

export type HeaderAction = {
  iconName: GlobalIconName
  label: string
  justIcon?: boolean
  routerLink?: string
  href?: string
  click?: (e: Event) => void
}

enum GroupDate {
  UNKNOWN = 0,
  TODAY = 1,
  YESTERDAY = 2,
  THIS_WEEK = 3,
  THIS_MONTH = 4,
  LAST_MONTH = 5,
  OLDER = 6
}

@Component({
  selector: 'my-videos-list',
  templateUrl: './videos-list.component.html',
  styleUrls: [ './videos-list.component.scss' ]
})
export class VideosListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() getVideosObservableFunction: (pagination: ComponentPaginationLight, filters: VideoFilters) => Observable<ResultList<Video>>
  @Input() getSyndicationItemsFunction: (filters: VideoFilters) => Promise<Syndication[]> | Syndication[]
  @Input() baseRouteBuilderFunction: (filters: VideoFilters) => string[]

  @Input() title: string
  @Input() titleTooltip: string
  @Input() displayTitle = true

  @Input() defaultSort: VideoSortField
  @Input() defaultScope: VideoFilterScope = 'federated'
  @Input() displayFilters = false
  @Input() displayModerationBlock = false

  @Input() loadUserVideoPreferences = false

  @Input() displayAsRow = false
  @Input() displayVideoActions = true
  @Input() groupByDate = false

  @Input() headerActions: HeaderAction[] = []

  @Input() hideScopeFilter = false

  @Input() displayOptions: MiniatureDisplayOptions

  @Input() disabled = false

  @Output() filtersChanged = new EventEmitter<VideoFilters>()
  @Output() videosLoaded = new EventEmitter<Video[]>()

  videos: Video[] = []
  filters: VideoFilters
  syndicationItems: Syndication[]

  onDataSubject = new Subject<any[]>()
  hasDoneFirstQuery = false

  userMiniature: User

  private defaultDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: false,
    privacyLabel: true,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }
  private routeSub: Subscription
  private userSub: Subscription
  private resizeSub: Subscription

  private pagination: ComponentPaginationLight = {
    currentPage: 1,
    itemsPerPage: 25
  }

  private groupedDateLabels: { [id in GroupDate]: string }
  private groupedDates: { [id: number]: GroupDate } = {}

  private lastQueryLength: number

  private videoRequests = new Subject<{ reset: boolean, obs: Observable<ResultList<Video>> }>()

  constructor (
    private notifier: Notifier,
    private authService: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
    private screenService: ScreenService,
    private peertubeRouter: PeerTubeRouterService,
    private serverService: ServerService
  ) {

  }

  ngOnInit () {
    this.subscribeToVideoRequests()

    const hiddenFilters = this.hideScopeFilter
      ? [ 'scope' ]
      : []

    this.filters = new VideoFilters(this.defaultSort, this.defaultScope, hiddenFilters)
    this.filters.load({ ...this.route.snapshot.queryParams, scope: this.defaultScope })

    this.groupedDateLabels = {
      [GroupDate.UNKNOWN]: null,
      [GroupDate.TODAY]: $localize`Today`,
      [GroupDate.YESTERDAY]: $localize`Yesterday`,
      [GroupDate.THIS_WEEK]: $localize`This week`,
      [GroupDate.THIS_MONTH]: $localize`This month`,
      [GroupDate.LAST_MONTH]: $localize`Last month`,
      [GroupDate.OLDER]: $localize`Older`
    }

    this.resizeSub = fromEvent(window, 'resize')
      .pipe(debounceTime(500))
      .subscribe(() => this.calcPageSizes())

    this.calcPageSizes()

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => {
        this.userMiniature = user

        if (this.loadUserVideoPreferences) {
          this.loadUserSettings(user)
        }

        this.scheduleOnFiltersChanged(false)

        this.subscribeToAnonymousUpdate()
        this.subscribeToSearchChange()
      })

    // Display avatar in mobile view
    if (this.screenService.isInMobileView()) {
      this.displayOptions.avatar = true
    }
  }

  ngOnDestroy () {
    if (this.resizeSub) this.resizeSub.unsubscribe()
    if (this.routeSub) this.routeSub.unsubscribe()
    if (this.userSub) this.userSub.unsubscribe()
  }

  ngOnChanges (changes: SimpleChanges) {
    if (changes['displayOptions'] || !this.displayOptions) {
      this.displayOptions = {
        ...this.defaultDisplayOptions,
        avatar: this.serverService.getHTMLConfig().client.videos.miniature.displayAuthorAvatar,
        ...changes['displayOptions']
      }
    }

    if (!this.filters) return

    let updated = false

    if (changes['defaultScope']) {
      updated = true
      this.filters.setDefaultScope(this.defaultScope)
    }

    if (changes['defaultSort']) {
      updated = true
      this.filters.setDefaultSort(this.defaultSort)
    }

    if (!updated) return

    const customizedByUser = this.hasBeenCustomizedByUser()

    if (!customizedByUser) {
      if (this.loadUserVideoPreferences) {
        this.loadUserSettings(this.userMiniature)
      }

      this.filters.reset('scope')
      this.filters.reset('sort')
    }

    this.scheduleOnFiltersChanged(customizedByUser)
  }

  videoById (_index: number, video: Video) {
    return video.id
  }

  onNearOfBottom () {
    if (this.disabled) return

    // No more results
    if (this.lastQueryLength !== undefined && this.lastQueryLength < this.pagination.itemsPerPage) return

    this.pagination.currentPage += 1

    this.loadMoreVideos()
  }

  loadMoreVideos (reset = false) {
    if (reset) {
      this.hasDoneFirstQuery = false
      this.videos = []
    }

    this.videoRequests.next({ reset, obs: this.getVideosObservableFunction(this.pagination, this.filters) })
  }

  reloadVideos () {
    console.log('reload')
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
            this.groupedDates[video.id] = currentGroupedDate
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

  scheduleOnFiltersChanged (customizedByUser: boolean) {
    // We'll reload videos, but avoid weird UI effect
    this.videos = []

    setTimeout(() => this.onFiltersChanged(customizedByUser))
  }

  onFiltersChanged (customizedByUser: boolean) {
    debugLogger('Running on filters changed')

    this.updateUrl(customizedByUser)

    this.filters.triggerChange()

    this.reloadSyndicationItems()
    this.reloadVideos()
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

  private loadUserSettings (user: User) {
    this.filters.setNSFWPolicy(user.nsfwPolicy)

    // Don't reset language filter if we don't want to refresh the component
    if (!this.hasBeenCustomizedByUser()) {
      this.filters.load({ languageOneOf: user.videoLanguages })
    }
  }

  private reloadSyndicationItems () {
    Promise.resolve(this.getSyndicationItemsFunction(this.filters))
      .then(items => {
        if (!items || items.length === 0) this.syndicationItems = undefined
        else this.syndicationItems = items
      })
      .catch(err => logger.error('Cannot get syndication items.', err))
  }

  private updateUrl (customizedByUser: boolean) {
    const baseQuery = this.filters.toUrlObject()

    // Set or reset customized by user query param
    const queryParams = customizedByUser || this.hasBeenCustomizedByUser()
      ? { ...baseQuery, c: customizedByUser }
      : baseQuery

    debugLogger('Will inject %O in URL query', queryParams)

    const baseRoute = this.baseRouteBuilderFunction
      ? this.baseRouteBuilderFunction(this.filters)
      : []

    const pathname = window.location.pathname

    const baseRouteChanged = baseRoute.length !== 0 &&
                             pathname !== '/' && // Exclude special '/' case, we'll be redirected without component change
                             baseRoute.length !== 0 && pathname !== baseRoute.join('/')

    if (baseRouteChanged || Object.keys(baseQuery).length !== 0 || customizedByUser) {
      this.peertubeRouter.silentNavigate(baseRoute, queryParams)
    }

    this.filtersChanged.emit(this.filters)
  }

  private hasBeenCustomizedByUser () {
    return this.route.snapshot.queryParams['c'] === 'true'
  }

  private subscribeToAnonymousUpdate () {
    this.userSub = this.userService.listenAnonymousUpdate()
      .pipe(switchMap(() => this.userService.getAnonymousOrLoggedUser()))
      .subscribe(user => {
        if (this.loadUserVideoPreferences) {
          this.loadUserSettings(user)
        }

        if (this.hasDoneFirstQuery) {
          this.reloadVideos()
        }
      })
  }

  private subscribeToSearchChange () {
    this.routeSub = this.route.queryParams.subscribe(param => {
      if (!param['search']) return

      this.filters.load({ search: param['search'] })
      this.onFiltersChanged(true)
    })
  }

  private subscribeToVideoRequests () {
    this.videoRequests
      .pipe(concatMap(({ reset, obs }) => obs.pipe(map(({ data }) => ({ data, reset })))))
      .subscribe({
        next: ({ data, reset }) => {
          this.hasDoneFirstQuery = true
          this.lastQueryLength = data.length

          if (reset) this.videos = []
          this.videos = this.videos.concat(data)
          console.log('subscribe')
          if (this.groupByDate) this.buildGroupedDateLabels()

          this.onDataSubject.next(data)
          this.videosLoaded.emit(this.videos)
        },

        error: err => {
          const message = $localize`Cannot load more videos. Try again later.`

          logger.error(message, err)
          this.notifier.error(message)
        }
      })
  }
}
