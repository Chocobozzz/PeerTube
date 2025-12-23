import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, booleanAttribute, inject, input, output } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import {
  ComponentPagination,
  ComponentPaginationLight,
  Notifier,
  PeerTubeRouterService,
  ScreenService,
  User,
  UserService,
  resetCurrentPage,
  updatePaginationOnDelete
} from '@app/core'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { ResultList, VideoSortField } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { Observable, Subject, Subscription, forkJoin, fromEvent, of } from 'rxjs'
import { concatMap, debounceTime, map, switchMap } from 'rxjs/operators'
import { ButtonComponent } from '../shared-main/buttons/button.component'
import { InfiniteScrollerDirective } from '../shared-main/common/infinite-scroller.directive'
import { DateGroupLabelComponent, GroupDate, GroupDateLabels } from '../shared-main/date/date-group-label.component'
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

@Component({
  selector: 'my-videos-list',
  templateUrl: './videos-list.component.html',
  styleUrls: [ './videos-list.component.scss' ],
  imports: [
    CommonModule,
    ButtonComponent,
    ButtonComponent,
    VideoFiltersHeaderComponent,
    InfiniteScrollerDirective,
    VideoMiniatureComponent,
    GlobalIconComponent,
    DateGroupLabelComponent
  ]
})
export class VideosListComponent implements OnInit, OnDestroy {
  private notifier = inject(Notifier)
  private userService = inject(UserService)
  private route = inject(ActivatedRoute)
  private screenService = inject(ScreenService)
  private peertubeRouter = inject(PeerTubeRouterService)

  // dprint-ignore
  // eslint-disable-next-line max-len
  readonly getVideosObservableFunction = input<(pagination: ComponentPaginationLight, filters: VideoFilters) => Observable<ResultList<Video>>>(undefined)
  readonly getSyndicationItemsFunction = input<(filters: VideoFilters) => Promise<Syndication[]> | Syndication[]>(undefined)

  readonly defaultSort = input<VideoSortField>(undefined)
  readonly defaultScope = input<VideoFilterScope>('federated')
  readonly displayFilters = input(false, { transform: booleanAttribute })
  readonly displayBy = input(true, { transform: booleanAttribute })
  readonly hideScopeFilter = input(false, { transform: booleanAttribute })

  readonly loadUserVideoPreferences = input(false, { transform: booleanAttribute })

  readonly displayAsRow = input(false, { transform: booleanAttribute })
  readonly displayVideoActions = input(true, { transform: booleanAttribute })
  readonly groupByDate = input(false, { transform: booleanAttribute })
  readonly highlightLives = input(false, { transform: booleanAttribute })

  readonly headerActions = input<HeaderAction[]>([])

  readonly disabled = input(false, { transform: booleanAttribute })

  readonly filtersChanged = output<VideoFilters>()
  readonly videosLoaded = output<Video[]>()

  videos: Video[] = []
  highlightedLives: Video[] = []

  filters: VideoFilters
  syndicationItems: Syndication[]

  onVideosDataSubject = new Subject<any[]>()
  hasDoneFirstQuery = false

  user: User

  displayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true,
    privacyLabel: true
  }
  displayModerationBlock = true

  groupByDateStore = new Set<number>()
  groupedDateLabels: GroupDateLabels = {
    [GroupDate.TODAY]: $localize`Today's videos`,
    [GroupDate.YESTERDAY]: $localize`Yesterday's videos`,
    [GroupDate.THIS_WEEK]: $localize`This week's videos`,
    [GroupDate.THIS_MONTH]: $localize`This month's videos`,
    [GroupDate.LAST_MONTH]: $localize`Last month's videos`,
    [GroupDate.OLDER]: $localize`Older videos`
  }

  private routeSub: Subscription
  private userSub: Subscription
  private resizeSub: Subscription

  private pagination: ComponentPagination = {
    currentPage: 1,
    itemsPerPage: 25,
    totalItems: null
  }

  private lastQueryLength: number

  private videoRequests = new Subject<{
    reset: boolean
    obsVideos: Observable<Pick<ResultList<Video>, 'data'>>
    obsHighlightedLives: Observable<Pick<ResultList<Video>, 'data'>>
  }>()

  private alreadyDoneSearch = false

  ngOnInit () {
    this.displayOptions.by = this.displayBy()
    this.displayOptions.avatar = this.displayBy()

    this.subscribeToVideoRequests()

    const hiddenFilters = this.hideScopeFilter()
      ? [ 'scope' ]
      : []

    this.filters = new VideoFilters(this.defaultSort(), this.defaultScope(), hiddenFilters)

    this.resizeSub = fromEvent(window, 'resize')
      .pipe(debounceTime(500))
      .subscribe(() => this.calcPageSizes())

    this.calcPageSizes()

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => {
        this.user = user

        if (this.loadUserVideoPreferences()) {
          this.loadUserSettings(user)
        }

        this.subscribeToAnonymousUpdate()
        this.subscribeToQueryParamsChange()
      })

    this.filters.load(this.route.snapshot.queryParams)

    this.filters.onChange(() => {
      debugLogger('Filters changed', this.filters)

      // We'll reload videos, but avoid weird UI effect
      this.videos = []
      this.highlightedLives = []

      this.updateUrl()

      this.reloadSyndicationItems()
      this.reloadVideos()

      this.filtersChanged.emit(this.filters)
    })

    this.reloadSyndicationItems()
    this.reloadVideos()
  }

  ngOnDestroy () {
    if (this.resizeSub) this.resizeSub.unsubscribe()
    if (this.routeSub) this.routeSub.unsubscribe()
    if (this.userSub) this.userSub.unsubscribe()
  }

  videoById (_index: number, video: Video) {
    return video.id
  }

  onNearOfBottom () {
    if (this.disabled()) return

    if (window.location.pathname === '/') {
      this.peertubeRouter.silentNavigate([], this.route.snapshot.queryParams)
    }

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
      this.groupByDateStore.clear()

      if (this.highlightLives() && (!this.filters.live || this.filters.live === 'both')) {
        liveFilters = this.filters.clone()
        liveFilters.live = 'true'

        videoFilters = this.filters.clone()
        videoFilters.live = 'false'
      }
    }

    this.videoRequests.next({
      reset,
      obsVideos: this.getVideosObservableFunction()(this.pagination, videoFilters ?? this.filters),

      obsHighlightedLives: liveFilters
        ? this.getVideosObservableFunction()(this.pagination, liveFilters)
        : of({ data: this.highlightedLives })
    })
  }

  reloadVideos () {
    resetCurrentPage(this.pagination)
    this.loadMoreVideos(true)
  }

  removeVideoFromArray (video: Video) {
    if (this.videos.some(v => v.id === video.id)) {
      this.videos = this.videos.filter(v => v.id !== video.id)

      updatePaginationOnDelete(this.pagination)
    }

    this.highlightedLives = this.highlightedLives.filter(v => v.id !== video.id)
  }

  private calcPageSizes () {
    if (this.screenService.isInMobileView()) {
      this.pagination.itemsPerPage = 5
    }
  }

  private loadUserSettings (user: User) {
    this.filters.setNSFWPolicy(user)

    this.filters.setDefaultLanguages(user.videoLanguages)
  }

  private reloadSyndicationItems () {
    Promise.resolve(this.getSyndicationItemsFunction()(this.filters))
      .then(items => {
        if (!items || items.length === 0) this.syndicationItems = undefined
        else this.syndicationItems = items
      })
      .catch(err => logger.error('Cannot get syndication items.', err))
  }

  private updateUrl () {
    const queryParams = this.filters.toUrlObject()

    debugLogger('Will inject URL query', { queryParams })

    if (Object.keys(queryParams).length !== 0 || this.filters.hasBeenCustomizedByUser()) {
      this.peertubeRouter.silentNavigate([], queryParams)
    }
  }

  private subscribeToAnonymousUpdate () {
    this.userSub = this.userService.listenAnonymousUpdate()
      .pipe(switchMap(() => this.userService.getAnonymousOrLoggedUser()))
      .subscribe(user => {
        debugLogger('User changed', { user })

        this.user = user

        if (this.loadUserVideoPreferences()) {
          this.loadUserSettings(user)
        }

        if (this.hasDoneFirstQuery) {
          this.reloadVideos()
        }
      })
  }

  private subscribeToQueryParamsChange () {
    this.routeSub = this.route.queryParams.subscribe(params => {
      if (Object.keys(params).length === 0 && !this.filters.hasBeenCustomizedByUser()) return

      let search = params.search

      if (search) {
        this.alreadyDoneSearch = true
      } else if (this.alreadyDoneSearch) {
        search = ''
      }

      debugLogger('Query params changed', params)

      this.filters.load(params)
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

          this.onVideosDataSubject.next(videos)
          this.videosLoaded.emit(this.videos)
        },

        error: err => {
          const message = $localize`Cannot load more videos. Please try again later.`

          logger.error(message, err)
          this.notifier.error(message)
        }
      })
  }
}
