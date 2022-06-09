import { forkJoin, of, Subscription } from 'rxjs'
import { LinkType } from 'src/types/link.type'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService, HooksService, MetaService, Notifier, ServerService, User, UserService } from '@app/core'
import { immutableAssign } from '@app/helpers'
import { Video, VideoChannel } from '@app/shared/shared-main'
import { AdvancedSearch, SearchService } from '@app/shared/shared-search'
import { MiniatureDisplayOptions } from '@app/shared/shared-video-miniature'
import { VideoPlaylist } from '@app/shared/shared-video-playlist'
import { HTMLServerConfig, SearchTargetType } from '@shared/models'

@Component({
  selector: 'my-search',
  styleUrls: [ './search.component.scss' ],
  templateUrl: './search.component.html'
})
export class SearchComponent implements OnInit, OnDestroy {
  results: (Video | VideoChannel)[] = []

  pagination = {
    currentPage: 1,
    totalItems: null as number
  }
  advancedSearch: AdvancedSearch = new AdvancedSearch()
  isSearchFilterCollapsed = true
  currentSearch: string

  videoDisplayOptions: MiniatureDisplayOptions = {
    date: true,
    views: true,
    by: true,
    avatar: false,
    privacyLabel: false,
    privacyText: false,
    state: false,
    blacklistInfo: false
  }

  errorMessage: string

  userMiniature: User

  private subActivatedRoute: Subscription
  private isInitialLoad = false // set to false to show the search filters on first arrival

  private channelsPerPage = 2
  private playlistsPerPage = 2
  private videosPerPage = 10

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

    this.subActivatedRoute = this.route.queryParams.subscribe(
      async queryParams => {
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

        // Don't hide filters if we have some of them AND the user just came on the webpage
        this.isSearchFilterCollapsed = this.isInitialLoad === false || !this.advancedSearch.containsValues()
        this.isInitialLoad = false

        this.search()
      },

      err => this.notifier.error(err.text)
    )

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
    this.isSearching = true

    forkJoin([
      this.getVideoChannelObs(),
      this.getVideoPlaylistObs(),
      this.getVideosObs()
    ]).subscribe(results => {
      for (const result of results) {
        this.results = this.results.concat(result.data)
      }

      this.pagination.totalItems = results.reduce((p, r) => p += r.total, 0)
      this.lastSearchTarget = this.advancedSearch.searchTarget

      this.hasMoreResults = this.results.length < this.pagination.totalItems
    },

    err => {
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

    () => {
      this.isSearching = false
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
    this.results = this.results.filter(r => !this.isVideo(r) || r.id !== video.id)
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

  private resetPagination () {
    this.pagination.currentPage = 1
    this.pagination.totalItems = null
    this.channelsPerPage = 2

    this.results = []
  }

  private updateTitle () {
    const suffix = this.currentSearch
      ? ' ' + this.currentSearch
      : ''

    this.metaService.setTitle($localize`Search` + suffix)
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
      componentPagination: immutableAssign(this.pagination, { itemsPerPage: this.videosPerPage }),
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
    if (!this.currentSearch) return of({ data: [], total: 0 })

    const params = {
      search: this.currentSearch,
      componentPagination: immutableAssign(this.pagination, { itemsPerPage: this.channelsPerPage }),
      searchTarget: this.advancedSearch.searchTarget
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
    if (!this.currentSearch) return of({ data: [], total: 0 })

    const params = {
      search: this.currentSearch,
      componentPagination: immutableAssign(this.pagination, { itemsPerPage: this.playlistsPerPage }),
      searchTarget: this.advancedSearch.searchTarget
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
}
