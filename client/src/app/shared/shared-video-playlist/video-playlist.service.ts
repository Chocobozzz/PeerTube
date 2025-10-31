import { HttpClient, HttpContext, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { AuthService, AuthUser, ComponentPaginationLight, RestExtractor, RestPagination, RestService, ServerService } from '@app/core'
import { buildBulkObservable, objectToFormData } from '@app/helpers'
import { NGX_LOADING_BAR_IGNORED } from '@ngx-loading-bar/http-client'
import {
  CachedVideoExistInPlaylist,
  CachedVideosExistInPlaylists,
  ResultList,
  VideoPlaylistElement as ServerVideoPlaylistElement,
  VideoExistInPlaylist,
  VideoPlaylistCreate,
  VideoPlaylistElementCreate,
  VideoPlaylistElementUpdate,
  VideoPlaylistReorder,
  VideoPlaylist as VideoPlaylistServerModel,
  VideoPlaylistUpdate,
  VideosExistInPlaylists
} from '@peertube/peertube-models'
import debug from 'debug'
import { SortMeta } from 'primeng/api'
import { merge, Observable, of, ReplaySubject, Subject } from 'rxjs'
import { catchError, filter, map, share, switchMap, tap } from 'rxjs/operators'
import { environment } from '../../../environments/environment'
import { Account } from '../shared-main/account/account.model'
import { AccountService } from '../shared-main/account/account.service'
import { VideoChannel } from '../shared-main/channel/video-channel.model'
import { VideoChannelService } from '../shared-main/channel/video-channel.service'
import { VideoPlaylistElement } from './video-playlist-element.model'
import { VideoPlaylist } from './video-playlist.model'

const debugLogger = debug('peertube:playlists:VideoPlaylistService')

export type CachedPlaylist = VideoPlaylist | { id: number, displayName: string }

@Injectable({ providedIn: 'root' })
export class VideoPlaylistService {
  private authHttp = inject(HttpClient)
  private auth = inject(AuthService)
  private serverService = inject(ServerService)
  private restExtractor = inject(RestExtractor)
  private restService = inject(RestService)

  static BASE_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/video-playlists/'
  static MY_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/users/me/video-playlists/'

  // Use a replay subject because we "next" a value before subscribing
  private videoExistsInPlaylistNotifier = new ReplaySubject<number>(1)
  private videoExistsInPlaylistCacheSubject = new Subject<CachedVideosExistInPlaylists>()
  private readonly videoExistsInPlaylistObservable: Observable<CachedVideosExistInPlaylists>

  private videoExistsObservableCache: { [id: number]: Observable<CachedVideoExistInPlaylist[]> } = {}
  private videoExistsCache: { [id: number]: CachedVideoExistInPlaylist[] } = {}

  private myAccountPlaylistCache: ResultList<CachedPlaylist> = undefined
  private myAccountPlaylistCacheRunning: Observable<ResultList<CachedPlaylist>>
  private myAccountPlaylistCacheSubject = new Subject<ResultList<CachedPlaylist>>()

  constructor () {
    this.videoExistsInPlaylistObservable = merge(
      buildBulkObservable({
        time: 200,
        bulkGet: (videoIds: number[]) => {
          // We added a delay to the request, so ensure the user is still logged in
          if (this.auth.isLoggedIn()) {
            return this.doVideosExistInPlaylist(videoIds)
          }

          return of({})
        },
        notifierObservable: this.videoExistsInPlaylistNotifier
      }).pipe(map(({ response }) => response)),
      this.videoExistsInPlaylistCacheSubject
    )
  }

  listChannelPlaylists (options: {
    videoChannel: Pick<VideoChannel, 'nameWithHost'>
    sort?: SortMeta | string
    componentPagination?: ComponentPaginationLight
    restPagination?: RestPagination
    search?: string
    includeCollaborations?: boolean
  }): Observable<ResultList<VideoPlaylist>> {
    const { videoChannel } = options

    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.nameWithHost + '/video-playlists'

    return this.listPlaylists({ url, ...options })
  }

  listAccountPlaylists (options: {
    account: Account
    sort: SortMeta | string
    restPagination?: RestPagination
    search?: string
    includeCollaborations?: boolean
  }): Observable<ResultList<VideoPlaylist>> {
    const { account } = options

    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-playlists'

    return this.listPlaylists({ url, ...options })
  }

  private listPlaylists (options: {
    url: string
    sort?: SortMeta | string
    componentPagination?: ComponentPaginationLight
    restPagination?: RestPagination
    search?: string
    includeCollaborations?: boolean
  }) {
    const { url, sort, search, includeCollaborations } = options

    let params = new HttpParams()

    let restPagination = options.restPagination
    if (!restPagination && options.componentPagination) {
      restPagination = this.restService.componentToRestPagination(options.componentPagination)
    }

    params = this.restService.addRestGetParams(params, restPagination, sort)

    if (includeCollaborations) params = params.append('includeCollaborations', 'true')
    if (search) params = this.restService.addObjectParams(params, { search })

    return this.authHttp.get<ResultList<VideoPlaylist>>(url, { params })
      .pipe(
        switchMap(res => this.extractPlaylists(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  listMyPlaylistWithCache (user: AuthUser, search?: string) {
    if (!search) {
      if (this.myAccountPlaylistCacheRunning) return this.myAccountPlaylistCacheRunning
      if (this.myAccountPlaylistCache) return of(this.myAccountPlaylistCache)
    }

    const obs = this.listAccountPlaylists({
      account: user.account,
      sort: '-updatedAt',
      search
    }).pipe(
      tap(result => {
        if (!search) {
          this.myAccountPlaylistCacheRunning = undefined
          this.myAccountPlaylistCache = result
        }
      }),
      share()
    )

    if (!search) this.myAccountPlaylistCacheRunning = obs
    return obs
  }

  // ---------------------------------------------------------------------------

  getVideoPlaylist (id: string | number) {
    const url = VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + id

    return this.authHttp.get<VideoPlaylist>(url)
      .pipe(
        switchMap(res => this.extractPlaylist(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  createVideoPlaylist (body: VideoPlaylistCreate) {
    const data = objectToFormData(body)

    return this.authHttp.post<{ videoPlaylist: { id: number } }>(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL, data)
      .pipe(
        tap(res => {
          if (!this.myAccountPlaylistCache) return

          this.myAccountPlaylistCache.total++

          this.myAccountPlaylistCache.data.push({
            id: res.videoPlaylist.id,
            displayName: body.displayName
          })

          this.myAccountPlaylistCacheSubject.next(this.myAccountPlaylistCache)
        }),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  updateVideoPlaylist (videoPlaylist: VideoPlaylist, body: VideoPlaylistUpdate) {
    const data = objectToFormData(body)

    return this.authHttp.put(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + videoPlaylist.id, data)
      .pipe(
        tap(() => {
          if (!this.myAccountPlaylistCache) return

          const playlist = this.myAccountPlaylistCache.data.find(p => p.id === videoPlaylist.id)
          playlist.displayName = body.displayName

          this.myAccountPlaylistCacheSubject.next(this.myAccountPlaylistCache)
        }),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  removeVideoPlaylist (videoPlaylist: VideoPlaylist) {
    return this.authHttp.delete(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + videoPlaylist.id)
      .pipe(
        tap(() => {
          if (!this.myAccountPlaylistCache) return

          this.myAccountPlaylistCache.total--
          this.myAccountPlaylistCache.data = this.myAccountPlaylistCache.data
            .filter(p => p.id !== videoPlaylist.id)

          this.myAccountPlaylistCacheSubject.next(this.myAccountPlaylistCache)
        }),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  addVideoInPlaylist (playlistId: number, body: VideoPlaylistElementCreate) {
    const url = VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos'

    return this.authHttp.post<{ videoPlaylistElement: { id: number } }>(url, body)
      .pipe(
        tap(res => {
          const existsResult = this.videoExistsCache[body.videoId]
          existsResult.push({
            playlistId,
            playlistElementId: res.videoPlaylistElement.id,
            startTimestamp: body.startTimestamp,
            stopTimestamp: body.stopTimestamp
          })

          this.runVideoExistsInPlaylistCheck(body.videoId)

          if (this.myAccountPlaylistCache) {
            const playlist = this.myAccountPlaylistCache.data.find(p => p.id === playlistId)
            if (!playlist) return

            const otherPlaylists = this.myAccountPlaylistCache.data.filter(p => p !== playlist)
            this.myAccountPlaylistCache.data = [ playlist, ...otherPlaylists ]
          }
        }),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  updateVideoOfPlaylist (playlistId: number, playlistElementId: number, body: VideoPlaylistElementUpdate, videoId: number) {
    return this.authHttp.put(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/' + playlistElementId, body)
      .pipe(
        tap(() => {
          const existsResult = this.videoExistsCache[videoId]

          if (existsResult) {
            const elem = existsResult.find(e => e.playlistElementId === playlistElementId)

            elem.startTimestamp = body.startTimestamp
            elem.stopTimestamp = body.stopTimestamp
          }

          this.runVideoExistsInPlaylistCheck(videoId)
        }),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  removeVideoFromPlaylist (playlistId: number, playlistElementId: number, videoId?: number) {
    return this.authHttp.delete(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/' + playlistElementId)
      .pipe(
        tap(() => {
          if (!videoId) return

          if (this.videoExistsCache[videoId]) {
            this.videoExistsCache[videoId] = this.videoExistsCache[videoId]
              .filter(e => e.playlistElementId !== playlistElementId)
          }

          this.runVideoExistsInPlaylistCheck(videoId)
        }),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  // ---------------------------------------------------------------------------

  reorderPlaylistsOfChannel (channelName: string, oldPosition: number, newPosition: number) {
    const body: VideoPlaylistReorder = {
      startPosition: oldPosition,
      insertAfterPosition: newPosition
    }

    return this.authHttp.post(VideoChannelService.BASE_VIDEO_CHANNEL_URL + channelName + '/video-playlists/reorder', body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  reorderVideosOfPlaylist (playlistId: number, oldPosition: number, newPosition: number) {
    const body: VideoPlaylistReorder = {
      startPosition: oldPosition,
      insertAfterPosition: newPosition
    }

    return this.authHttp.post(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/reorder', body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  getPlaylistVideos (options: {
    videoPlaylistId: number | string
    componentPagination: ComponentPaginationLight
  }): Observable<ResultList<VideoPlaylistElement>> {
    const path = VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + options.videoPlaylistId + '/videos'
    const pagination = this.restService.componentToRestPagination(options.componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    return this.authHttp
      .get<ResultList<ServerVideoPlaylistElement>>(path, { params })
      .pipe(
        switchMap(res => this.extractVideoPlaylistElements(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  listenToMyAccountPlaylistsChange () {
    return this.myAccountPlaylistCacheSubject.asObservable()
  }

  listenToVideoPlaylistChange (videoId: number) {
    if (this.videoExistsObservableCache[videoId]) {
      return this.videoExistsObservableCache[videoId]
    }

    const obs = this.videoExistsInPlaylistObservable
      .pipe(
        map(existsResult => existsResult[videoId]),
        filter(r => !!r),
        tap(result => this.videoExistsCache[videoId] = result)
      )

    this.videoExistsObservableCache[videoId] = obs
    return obs
  }

  runVideoExistsInPlaylistCheck (videoId: number) {
    debugLogger('Running playlist check.')

    if (this.videoExistsCache[videoId]) {
      debugLogger('Found cache for %d.', videoId)

      return this.videoExistsInPlaylistCacheSubject.next({ [videoId]: this.videoExistsCache[videoId] })
    }

    debugLogger('Fetching from network for %d.', videoId)
    return this.videoExistsInPlaylistNotifier.next(videoId)
  }

  extractPlaylists (result: ResultList<VideoPlaylistServerModel>) {
    return this.serverService.getServerLocale()
      .pipe(
        map(translations => {
          const playlistsJSON = result.data
          const total = result.total
          const playlists: VideoPlaylist[] = []

          for (const playlistJSON of playlistsJSON) {
            playlists.push(new VideoPlaylist(playlistJSON, translations))
          }

          return { data: playlists, total }
        })
      )
  }

  extractPlaylist (playlist: VideoPlaylistServerModel) {
    return this.serverService.getServerLocale()
      .pipe(map(translations => new VideoPlaylist(playlist, translations)))
  }

  extractVideoPlaylistElements (result: ResultList<ServerVideoPlaylistElement>) {
    return this.serverService.getServerLocale()
      .pipe(
        map(translations => {
          const elementsJson = result.data
          const total = result.total
          const elements: VideoPlaylistElement[] = []

          for (const elementJson of elementsJson) {
            elements.push(new VideoPlaylistElement(elementJson, translations))
          }

          return { total, data: elements }
        })
      )
  }

  doVideosExistInPlaylist (videoIds: number[]): Observable<VideosExistInPlaylists> {
    const url = VideoPlaylistService.MY_VIDEO_PLAYLIST_URL + 'videos-exist'

    let params = new HttpParams()
    params = this.restService.addObjectParams(params, { videoIds })

    return this.authHttp.get<VideoExistInPlaylist>(url, { params, context: new HttpContext().set(NGX_LOADING_BAR_IGNORED, true) })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
