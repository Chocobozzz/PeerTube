import { NgClass, NgFor, NgIf } from '@angular/common'
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, booleanAttribute } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import {
  AuthService,
  ComponentPaginationLight,
  Notifier,
  PeerTubeRouterService,
  ScreenService,
  User,
  UserService
} from '@app/core'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { isLastMonth, isLastWeek, isThisMonth, isToday, isYesterday } from '@peertube/peertube-core-utils'
import { ResultList, UserRight, VideoSortField } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { Observable, Subject, Subscription, forkJoin, fromEvent, of } from 'rxjs'
import { concatMap, debounceTime, map, switchMap } from 'rxjs/operators'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { InfiniteScrollerDirective } from '../shared-main/common/infinite-scroller.directive'
import { Syndication } from '../shared-main/feeds/syndication.model'
import { Video } from '../shared-main/video/video.model'
import { VideoFiltersHeaderComponent } from './video-filters-header.component'
import { VideoFilterScope, VideoFilters } from './video-filters.model'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from './video-miniature.component'

const debugLogger = debug('peertube:videos:VideosListComponent')

export type HeaderAction = {
  iconName: GlobalIconName
  label: string
  routerLink?: string
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
  styleUrls: [ './videos-list.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    NgClass,
    NgFor,
    ButtonComponent,
    ButtonComponent,
    VideoFiltersHeaderComponent,
    InfiniteScrollerDirective,
    VideoMiniatureComponent,
    GlobalIconComponent
  ]
})
export class VideosListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() getVideosObservableFunction: (pagination: ComponentPaginationLight, filters: VideoFilters) => Observable<ResultList<Video>>
  @Input() getSyndicationItemsFunction: (filters: VideoFilters) => Promise<Syndication[]> | Syndication[]

  @Input() defaultSort: VideoSortField
  @Input() defaultScope: VideoFilterScope = 'federated'
  @Input({ transform: booleanAttribute }) displayFilters = false
  @Input({ transform: booleanAttribute }) displayModerationBlock = false

  @Input({ transform: booleanAttribute }) loadUserVideoPreferences = false

  @Input({ transform: booleanAttribute }) displayAsRow = false
  @Input({ transform: booleanAttribute }) displayVideoActions = true
  @Input({ transform: booleanAttribute }) groupByDate = false
  @Input({ transform: booleanAttribute }) highlightLives = false

  @Input() headerActions: HeaderAction[] = []

  @Input({ transform: booleanAttribute }) hideScopeFilter = false

  @Input() displayOptions: MiniatureDisplayOptions

  @Input({ transform: booleanAttribute }) disabled = false

  @Output() filtersChanged = new EventEmitter<VideoFilters>()
  @Output() videosLoaded = new EventEmitter<Video[]>()

  videos: Video[] = []
  highlightedLives: Video[] = []

  filters: VideoFilters
  syndicationItems: Syndication[]

  onVideosDataSubject = new Subject<any[]>()
  hasDoneFirstQuery = false

  userMiniature: User

  private defaultDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true,
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

  private videoRequests = new Subject<{
    reset: boolean
    obsVideos: Observable<Pick<ResultList<Video>, 'data'>>
    obsHighlightedLives: Observable<Pick<ResultList<Video>, 'data'>>
  }>()

  private alreadyDoneSearch = false

  constructor (
    private notifier: Notifier,
    private authService: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
    private screenService: ScreenService,
    private peertubeRouter: PeerTubeRouterService
  ) {

  }

  ngOnInit () {
    this.subscribeToVideoRequests()

    const hiddenFilters = this.hideScopeFilter
      ? [ 'scope' ]
      : []

    this.filters = new VideoFilters(this.defaultSort, this.defaultScope, hiddenFilters)
    this.filters.load({ scope: this.defaultScope, ...this.route.snapshot.queryParams })

    this.groupedDateLabels = {
      [GroupDate.UNKNOWN]: null,
      [GroupDate.TODAY]: $localize`Today's videos`,
      [GroupDate.YESTERDAY]: $localize`Yesterday's videos`,
      [GroupDate.THIS_WEEK]: $localize`This week's videos`,
      [GroupDate.THIS_MONTH]: $localize`This month's videos`,
      [GroupDate.LAST_MONTH]: $localize`Last month's videos`,
      [GroupDate.OLDER]: $localize`Older videos`
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

        ...(changes['displayOptions']?.currentValue ?? {})
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
    let liveFilters: VideoFilters
    let videoFilters: VideoFilters

    if (reset) {
      this.hasDoneFirstQuery = false
      this.videos = []
      this.highlightedLives = []

      if (this.highlightLives && (!this.filters.live || this.filters.live === 'both')) {
        liveFilters = this.filters.clone()
        liveFilters.live = 'true'

        videoFilters = this.filters.clone()
        videoFilters.live = 'false'
      }
    }

    this.videoRequests.next({
      reset,
      obsVideos: this.getVideosObservableFunction(this.pagination, videoFilters ?? this.filters),

      obsHighlightedLives: liveFilters
        ? this.getVideosObservableFunction(this.pagination, liveFilters)
        : of(({ data: this.highlightedLives }))
    })
  }

  reloadVideos () {
    this.pagination.currentPage = 1
    this.loadMoreVideos(true)
  }

  removeVideoFromArray (video: Video) {
    this.videos = this.videos.filter(v => v.id !== video.id)
    this.highlightedLives = this.highlightedLives.filter(v => v.id !== video.id)
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

    let onlyOlderPeriod = true

    for (const video of this.videos) {
      const publishedDate = video.publishedAt

      for (let i = 0; i < periods.length; i++) {
        const period = periods[i]

        if (currentGroupedDate <= period.value && period.validator(publishedDate)) {

          if (currentGroupedDate !== period.value) {
            if (period.value !== GroupDate.OLDER) onlyOlderPeriod = false

            currentGroupedDate = period.value
            this.groupedDates[video.id] = currentGroupedDate
          }

          break
        }
      }
    }

    // No need to group by date, there is only "Older" period available
    if (onlyOlderPeriod) this.groupedDates = {}
  }

  getCurrentGroupedDateLabel (video: Video) {
    if (this.groupByDate === false) return undefined

    return this.groupedDateLabels[this.groupedDates[video.id]]
  }

  scheduleOnFiltersChanged (customizedByUser: boolean) {
    // We'll reload videos, but avoid weird UI effect
    this.videos = []
    this.highlightedLives = []

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

    if (Object.keys(baseQuery).length !== 0 || customizedByUser) {
      this.peertubeRouter.silentNavigate([], queryParams)
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
      if (!this.alreadyDoneSearch && !param['search']) return

      this.alreadyDoneSearch = true
      this.filters.load({ search: param['search'] })
      this.onFiltersChanged(true)
    })
  }

  private subscribeToVideoRequests () {
    this.videoRequests
      .pipe(
        concatMap(({ reset, obsHighlightedLives, obsVideos }) => {
          return forkJoin([ obsHighlightedLives, obsVideos ])
            .pipe(
              map(([ resHighlightedLives, resVideos ]) => ({ highlightedLives: resHighlightedLives.data, videos: resVideos.data, reset }))
            )
        })
      )
      .subscribe({
        next: ({ videos, highlightedLives, reset }) => {
          this.hasDoneFirstQuery = true
          this.lastQueryLength = videos.length

          if (reset) {
            this.videos = []
            this.highlightedLives = highlightedLives
          }

          this.videos = this.videos.concat(videos)

          if (this.groupByDate) this.buildGroupedDateLabels()

          this.onVideosDataSubject.next(videos)
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
