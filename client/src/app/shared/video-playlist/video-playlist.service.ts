import { bufferTime, catchError, filter, first, map, share, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { Observable, ReplaySubject, Subject } from 'rxjs'
import { RestExtractor } from '../rest/rest-extractor.service'
import { HttpClient, HttpParams } from '@angular/common/http'
import { ResultList, VideoPlaylistElementCreate, VideoPlaylistElementUpdate } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { VideoPlaylist as VideoPlaylistServerModel } from '@shared/models/videos/playlist/video-playlist.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoPlaylistCreate } from '@shared/models/videos/playlist/video-playlist-create.model'
import { VideoPlaylistUpdate } from '@shared/models/videos/playlist/video-playlist-update.model'
import { objectToFormData } from '@app/shared/misc/utils'
import { ServerService } from '@app/core'
import { VideoPlaylist } from '@app/shared/video-playlist/video-playlist.model'
import { AccountService } from '@app/shared/account/account.service'
import { Account } from '@app/shared/account/account.model'
import { RestService } from '@app/shared/rest'
import { VideoExistInPlaylist } from '@shared/models/videos/playlist/video-exist-in-playlist.model'
import { VideoPlaylistReorder } from '@shared/models/videos/playlist/video-playlist-reorder.model'
import { ComponentPagination } from '@app/shared/rest/component-pagination.model'
import { VideoPlaylistElement as ServerVideoPlaylistElement } from '@shared/models/videos/playlist/video-playlist-element.model'
import { VideoPlaylistElement } from '@app/shared/video-playlist/video-playlist-element.model'

@Injectable()
export class VideoPlaylistService {
  static BASE_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/video-playlists/'
  static MY_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/users/me/video-playlists/'

  // Use a replay subject because we "next" a value before subscribing
  private videoExistsInPlaylistSubject: Subject<number> = new ReplaySubject(1)
  private readonly videoExistsInPlaylistObservable: Observable<VideoExistInPlaylist>

  constructor (
    private authHttp: HttpClient,
    private serverService: ServerService,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {
    this.videoExistsInPlaylistObservable = this.videoExistsInPlaylistSubject.pipe(
      bufferTime(500),
      filter(videoIds => videoIds.length !== 0),
      switchMap(videoIds => this.doVideosExistInPlaylist(videoIds)),
      share()
    )
  }

  listChannelPlaylists (videoChannel: VideoChannel, componentPagination: ComponentPagination): Observable<ResultList<VideoPlaylist>> {
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

  listAccountPlaylists (account: Account, componentPagination: ComponentPagination, sort: string): Observable<ResultList<VideoPlaylist>> {
    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-playlists'
    const pagination = componentPagination
      ? this.restService.componentPaginationToRestPagination(componentPagination)
      : undefined

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

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
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateVideoPlaylist (videoPlaylist: VideoPlaylist, body: VideoPlaylistUpdate) {
    const data = objectToFormData(body)

    return this.authHttp.put(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + videoPlaylist.id, data)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  removeVideoPlaylist (videoPlaylist: VideoPlaylist) {
    return this.authHttp.delete(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + videoPlaylist.id)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  addVideoInPlaylist (playlistId: number, body: VideoPlaylistElementCreate) {
    return this.authHttp.post(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos', body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateVideoOfPlaylist (playlistId: number, playlistElementId: number, body: VideoPlaylistElementUpdate) {
    return this.authHttp.put(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/' + playlistElementId, body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  removeVideoFromPlaylist (playlistId: number, playlistElementId: number) {
    return this.authHttp.delete(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL + playlistId + '/videos/' + playlistElementId)
               .pipe(
                 map(this.restExtractor.extractDataBool),
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
    componentPagination: ComponentPagination
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

  doesVideoExistInPlaylist (videoId: number) {
    this.videoExistsInPlaylistSubject.next(videoId)

    return this.videoExistsInPlaylistObservable.pipe(first())
  }

  extractPlaylists (result: ResultList<VideoPlaylistServerModel>) {
    return this.serverService.localeObservable
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
    return this.serverService.localeObservable
               .pipe(map(translations => new VideoPlaylist(playlist, translations)))
  }

  extractVideoPlaylistElements (result: ResultList<ServerVideoPlaylistElement>) {
    return this.serverService.localeObservable
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

  private doVideosExistInPlaylist (videoIds: number[]): Observable<VideoExistInPlaylist> {
    const url = VideoPlaylistService.MY_VIDEO_PLAYLIST_URL + 'videos-exist'
    let params = new HttpParams()

    params = this.restService.addObjectParams(params, { videoIds })

    return this.authHttp.get<VideoExistInPlaylist>(url, { params })
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
