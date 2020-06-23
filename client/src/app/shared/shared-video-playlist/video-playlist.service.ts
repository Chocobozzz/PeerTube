import * as debug from 'debug'
import { uniq } from 'lodash-es'
import { asyncScheduler, merge, Observable, of, ReplaySubject, Subject } from 'rxjs'
import { bufferTime, catchError, filter, map, observeOn, share, switchMap, tap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, NgZone } from '@angular/core'
import { AuthUser, ComponentPaginationLight, RestExtractor, RestService, ServerService } from '@app/core'
import { enterZone, leaveZone, objectToFormData } from '@app/helpers'
import { Account, AccountService, VideoChannel, VideoChannelService } from '@app/shared/shared-main'
import {
  ResultList,
  VideoExistInPlaylist,
  VideoPlaylist as VideoPlaylistServerModel,
  VideoPlaylistCreate,
  VideoPlaylistElement as ServerVideoPlaylistElement,
  VideoPlaylistElementCreate,
  VideoPlaylistElementUpdate,
  VideoPlaylistReorder,
  VideoPlaylistUpdate,
  VideosExistInPlaylists
} from '@shared/models'
import { environment } from '../../../environments/environment'
import { VideoPlaylistElement } from './video-playlist-element.model'
import { VideoPlaylist } from './video-playlist.model'

const logger = debug('peertube:playlists:VideoPlaylistService')

export type CachedPlaylist = VideoPlaylist | { id: number, displayName: string }

@Injectable()
export class VideoPlaylistService {
  static BASE_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/video-playlists/'
  static MY_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/users/me/video-playlists/'

  // Use a replay subject because we "next" a value before subscribing
  private videoExistsInPlaylistNotifier = new ReplaySubject<number>(1)
  private videoExistsInPlaylistCacheSubject = new Subject<VideosExistInPlaylists>()
  private readonly videoExistsInPlaylistObservable: Observable<VideosExistInPlaylists>

  private videoExistsObservableCache: { [ id: number ]: Observable<VideoExistInPlaylist[]> } = {}
  private videoExistsCache: { [ id: number ]: VideoExistInPlaylist[] } = {}

  private myAccountPlaylistCache: ResultList<CachedPlaylist> = undefined
  private myAccountPlaylistCacheRunning: Observable<ResultList<CachedPlaylist>>
  private myAccountPlaylistCacheSubject = new Subject<ResultList<CachedPlaylist>>()

  constructor (
    private authHttp: HttpClient,
    private serverService: ServerService,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private ngZone: NgZone
  ) {
    this.videoExistsInPlaylistObservable = merge(
      this.videoExistsInPlaylistNotifier.pipe(
        // We leave Angular zone so Protractor does not get stuck
        bufferTime(500, leaveZone(this.ngZone, asyncScheduler)),
        filter(videoIds => videoIds.length !== 0),
        map(videoIds => uniq(videoIds)),
        observeOn(enterZone(this.ngZone, asyncScheduler)),
        switchMap(videoIds => this.doVideosExistInPlaylist(videoIds)),
        share()
      ),

      this.videoExistsInPlaylistCacheSubject
    )
  }

  listChannelPlaylists (videoChannel: VideoChannel, componentPagination: ComponentPaginationLight): Observable<ResultList<VideoPlaylist>> {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.nameWithHost + '/video-playlists'
    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

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

    const obs = this.listAccountPlaylists(user.account, undefined, '-updatedAt', search)
               .pipe(
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

  listAccountPlaylists (
    account: Account,
    componentPagination: ComponentPaginationLight,
    sort: string,
    search?: string
  ): Observable<ResultList<VideoPlaylist>> {
    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-playlists'
    const pagination = componentPagination
      ? this.restService.componentPaginationToRestPagination(componentPagination)
      : undefined

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    if (search) params = this.restService.addObjectParams(params, { search })

    return this.authHttp.get<ResultList<VideoPlaylist>>(url, { params })
               .pipe(
                 switchMap(res => this.extractPlaylists(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

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
                 map(this.restExtractor.extractDataBool),
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
                 map(this.restExtractor.extractDataBool),
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

                   this.runPlaylistCheck(body.videoId)
                 }),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateVideoOfPlaylist (playlistId: number, playlistElementId: number, body: VideoPlaylistElementUpdate, videoId: number) {
    return this.authHttp.put(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/' + playlistElementId, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 tap(() => {
                   const existsResult = this.videoExistsCache[videoId]
                   const elem = existsResult.find(e => e.playlistElementId === playlistElementId)

                   elem.startTimestamp = body.startTimestamp
                   elem.stopTimestamp = body.stopTimestamp

                   this.runPlaylistCheck(videoId)
                 }),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  removeVideoFromPlaylist (playlistId: number, playlistElementId: number, videoId?: number) {
    return this.authHttp.delete(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/' + playlistElementId)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 tap(() => {
                   if (!videoId) return

                   this.videoExistsCache[videoId] = this.videoExistsCache[videoId].filter(e => e.playlistElementId !== playlistElementId)
                   this.runPlaylistCheck(videoId)
                 }),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  reorderPlaylist (playlistId: number, oldPosition: number, newPosition: number) {
    const body: VideoPlaylistReorder = {
      startPosition: oldPosition,
      insertAfterPosition: newPosition
    }

    return this.authHttp.post(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/reorder', body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  getPlaylistVideos (
    videoPlaylistId: number | string,
    componentPagination: ComponentPaginationLight
  ): Observable<ResultList<VideoPlaylistElement>> {
    const path = VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + videoPlaylistId + '/videos'
    const pagination = this.restService.componentPaginationToRestPagination(componentPagination)

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
    if (this.videoExistsObservableCache[ videoId ]) {
      return this.videoExistsObservableCache[ videoId ]
    }

    const obs = this.videoExistsInPlaylistObservable
                    .pipe(
                      map(existsResult => existsResult[ videoId ]),
                      filter(r => !!r),
                      tap(result => this.videoExistsCache[ videoId ] = result)
                    )

    this.videoExistsObservableCache[ videoId ] = obs
    return obs
  }

  runPlaylistCheck (videoId: number) {
    logger('Running playlist check.')

    if (this.videoExistsCache[videoId]) {
      logger('Found cache for %d.', videoId)

      return this.videoExistsInPlaylistCacheSubject.next({ [videoId]: this.videoExistsCache[videoId] })
    }

    logger('Fetching from network for %d.', videoId)
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

  private doVideosExistInPlaylist (videoIds: number[]): Observable<VideosExistInPlaylists> {
    const url = VideoPlaylistService.MY_VIDEO_PLAYLIST_URL + 'videos-exist'

    let params = new HttpParams()
    params = this.restService.addObjectParams(params, { videoIds })

    return this.authHttp.get<VideoExistInPlaylist>(url, { params, headers: { ignoreLoadingBar: '' } })
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
