import { NgFor, NgIf, NgTemplateOutlet } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { AuthService, HooksService, MetaService, Notifier, ServerService, User, UserService } from '@app/core'
import { immutableAssign, SimpleMemoize } from '@app/helpers'
import { validateHost } from '@app/shared/form-validators/host-validators'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { Video } from '@app/shared/shared-main/video/video.model'
import { AdvancedSearch } from '@app/shared/shared-search/advanced-search.model'
import { SearchService } from '@app/shared/shared-search/search.service'
import { VideoPlaylist } from '@app/shared/shared-video-playlist/video-playlist.model'
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap'
import { HTMLServerConfig, SearchTargetType } from '@peertube/peertube-models'
import { forkJoin, Subject, Subscription } from 'rxjs'
import { LinkType } from 'src/types/link.type'
import { ActorAvatarComponent } from '../shared/shared-actor-image/actor-avatar.component'
import { InfiniteScrollerDirective } from '../shared/shared-main/common/infinite-scroller.directive'
import { NumberFormatterPipe } from '../shared/shared-main/common/number-formatter.pipe'
import { SubscribeButtonComponent } from '../shared/shared-user-subscription/subscribe-button.component'
import { MiniatureDisplayOptions, VideoMiniatureComponent } from '../shared/shared-video-miniature/video-miniature.component'
import { VideoPlaylistMiniatureComponent } from '../shared/shared-video-playlist/video-playlist-miniature.component'
import { SearchFiltersComponent } from './search-filters.component'

@Component({
  selector: 'my-search',
  styleUrls: [ './search.component.scss' ],
  templateUrl: './search.component.html',
  imports: [
    InfiniteScrollerDirective,
    NgIf,
    NgbCollapse,
    SearchFiltersComponent,
    NgFor,
    ActorAvatarComponent,
    RouterLink,
    NgTemplateOutlet,
    SubscribeButtonComponent,
    VideoMiniatureComponent,
    VideoPlaylistMiniatureComponent,
    NumberFormatterPipe,
    AlertComponent,
    GlobalIconComponent
  ]
})
export class SearchComponent implements OnInit, OnDestroy {
  error: string

  results: (Video | VideoChannel | VideoPlaylist)[] = []

  pagination = {
    currentPage: 1,
    totalItems: null as number
  }
  deletedVideos = 0

  advancedSearch: AdvancedSearch = new AdvancedSearch()
  isSearchFilterCollapsed = true
  currentSearch: string

  videoDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: true,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  errorMessage: string

  userMiniature: User

  onSearchDataSubject = new Subject<any>()

  private subActivatedRoute: Subscription
  private isInitialLoad = false // set to false to show the search filters on first arrival

  private hasMoreResults = true
  private isSearching = false

  private lastSearchTarget: SearchTargetType

  private serverConfig: HTMLServerConfig

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private metaService: MetaService,
    private notifier: Notifier,
    private searchService: SearchService,
    private authService: AuthService,
    private userService: UserService,
    private hooks: HooksService,
    private serverService: ServerService
  ) { }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    this.subActivatedRoute = this.route.queryParams
      .subscribe({
        next: queryParams => {
          const querySearch = queryParams['search']
          const searchTarget = queryParams['searchTarget']

          // Search updated, reset filters
          if (this.currentSearch !== querySearch || searchTarget !== this.advancedSearch.searchTarget) {
            this.resetPagination()
            this.advancedSearch.reset()

            this.currentSearch = querySearch || undefined
            this.updateTitle()
          }

          this.advancedSearch = new AdvancedSearch(queryParams)
          if (!this.advancedSearch.searchTarget) {
            this.advancedSearch.searchTarget = this.getDefaultSearchTarget()
          }

          this.error = this.checkFieldsAndGetError()

          // Don't hide filters if we have some of them AND the user just came on the webpage, or we have an error
          this.isSearchFilterCollapsed = !this.error && (this.isInitialLoad === false || !this.advancedSearch.containsValues())
          this.isInitialLoad = false

          this.search()
        },

        error: err => this.notifier.error(err.message)
      })

    this.userService.getAnonymousOrLoggedUser()
      .subscribe(user => this.userMiniature = user)

    this.hooks.runAction('action:search.init', 'search')
  }

  ngOnDestroy () {
    if (this.subActivatedRoute) this.subActivatedRoute.unsubscribe()
  }

  isVideoChannel (d: VideoChannel | Video | VideoPlaylist): d is VideoChannel {
    return d instanceof VideoChannel
  }

  isVideo (v: VideoChannel | Video | VideoPlaylist): v is Video {
    return v instanceof Video
  }

  isPlaylist (v: VideoChannel | Video | VideoPlaylist): v is VideoPlaylist {
    return v instanceof VideoPlaylist
  }

  isUserLoggedIn () {
    return this.authService.isLoggedIn()
  }

  search () {
    this.error = this.checkFieldsAndGetError()
    if (this.error) return

    this.isSearching = true

    forkJoin([
      this.getVideoChannelObs(),
      this.getVideoPlaylistObs(),
      this.getVideosObs()
    ]).subscribe({
      next: results => {
        for (const result of results) {
          this.results = this.results.concat(result.data)
        }

        this.pagination.totalItems = results.reduce((p, r) => p += r.total, 0)
        this.lastSearchTarget = this.advancedSearch.searchTarget

        this.hasMoreResults = this.results.length < this.pagination.totalItems

        this.onSearchDataSubject.next(results)
      },

      error: err => {
        if (this.advancedSearch.searchTarget !== 'search-index') {
          this.notifier.error(err.message)
          return
        }

        this.notifier.error(
          $localize`Search index is unavailable. Retrying with instance results instead.`,
          $localize`Search error`
        )
        this.advancedSearch.searchTarget = 'local'
        this.search()
      },

      complete: () => {
        this.isSearching = false
      }
    })
  }

  onNearOfBottom () {
    // Last page
    if (!this.hasMoreResults || this.isSearching) return

    this.pagination.currentPage += 1
    this.search()
  }

  onFiltered () {
    this.resetPagination()

    this.updateUrlFromAdvancedSearch()
  }

  numberOfFilters () {
    return this.advancedSearch.size()
  }

  // Add VideoChannel/VideoPlaylist for typings, but the template already checks "video" argument is a video
  removeVideoFromArray (video: Video | VideoChannel | VideoPlaylist) {
    const previous = this.results
    this.results = this.results.filter(r => !this.isVideo(r) || r.id !== video.id)

    if (previous.length !== this.results.length) this.deletedVideos++
  }

  getLinkType (): LinkType {
    if (this.advancedSearch.searchTarget === 'search-index') {
      const remoteUriConfig = this.serverConfig.search.remoteUri

      // Redirect on the external instance if not allowed to fetch remote data
      if ((!this.isUserLoggedIn() && !remoteUriConfig.anonymous) || !remoteUriConfig.users) {
        return 'external'
      }

      return 'lazy-load'
    }

    return 'internal'
  }

  isExternalChannelUrl () {
    return this.getLinkType() === 'external'
  }

  getExternalChannelUrl (channel: VideoChannel) {
    // Same algorithm than videos
    if (this.getLinkType() === 'external') {
      return channel.url
    }

    // lazy-load or internal
    return undefined
  }

  @SimpleMemoize()
  getInternalChannelUrl (channel: VideoChannel) {
    const linkType = this.getLinkType()

    if (linkType === 'internal') {
      return [ '/c', channel.nameWithHost ]
    }

    if (linkType === 'lazy-load') {
      return [ '/search/lazy-load-channel', { url: channel.url } ]
    }

    // external
    return undefined
  }

  hideActions () {
    return this.lastSearchTarget === 'search-index'
  }

  getFilterButtonTitle () {
    return $localize`${this.numberOfFilters()} active filters, open the filters panel`
  }

  private resetPagination () {
    this.pagination.currentPage = 1
    this.pagination.totalItems = null
    this.deletedVideos = 0

    this.results = []
  }

  private updateTitle () {
    const title = this.currentSearch
      ? $localize`Search ${this.currentSearch}`
      : $localize`Search`

    this.metaService.setTitle(title)
  }

  private updateUrlFromAdvancedSearch () {
    const search = this.currentSearch || undefined

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.assign({}, this.advancedSearch.toUrlObject(), { search })
    })
  }

  private getVideosObs () {
    const params = {
      search: this.currentSearch,
      componentPagination: immutableAssign(this.pagination, { itemsPerPage: 10, itemsRemoved: this.deletedVideos }),
      advancedSearch: this.advancedSearch
    }

    return this.hooks.wrapObsFun(
      this.searchService.searchVideos.bind(this.searchService),
      params,
      'search',
      'filter:api.search.videos.list.params',
      'filter:api.search.videos.list.result'
    )
  }

  private getVideoChannelObs () {
    const params = {
      search: this.currentSearch,
      componentPagination: immutableAssign(this.pagination, { itemsPerPage: this.buildChannelsPerPage() }),
      advancedSearch: this.advancedSearch
    }

    return this.hooks.wrapObsFun(
      this.searchService.searchVideoChannels.bind(this.searchService),
      params,
      'search',
      'filter:api.search.video-channels.list.params',
      'filter:api.search.video-channels.list.result'
    )
  }

  private getVideoPlaylistObs () {
    const params = {
      search: this.currentSearch,
      componentPagination: immutableAssign(this.pagination, { itemsPerPage: this.buildPlaylistsPerPage() }),
      advancedSearch: this.advancedSearch
    }

    return this.hooks.wrapObsFun(
      this.searchService.searchVideoPlaylists.bind(this.searchService),
      params,
      'search',
      'filter:api.search.video-playlists.list.params',
      'filter:api.search.video-playlists.list.result'
    )
  }

  private getDefaultSearchTarget (): SearchTargetType {
    const searchIndexConfig = this.serverConfig.search.searchIndex

    if (searchIndexConfig.enabled && (searchIndexConfig.isDefaultSearch || searchIndexConfig.disableLocalSearch)) {
      return 'search-index'
    }

    return 'local'
  }

  private checkFieldsAndGetError () {
    if (this.advancedSearch.host && !validateHost(this.advancedSearch.host)) {
      return $localize`PeerTube instance host filter is invalid`
    }

    return undefined
  }

  private buildChannelsPerPage () {
    if (this.advancedSearch.resultType === 'channels') return 10

    return 2
  }

  private buildPlaylistsPerPage () {
    if (this.advancedSearch.resultType === 'playlists') return 10

    return 2
  }
}
