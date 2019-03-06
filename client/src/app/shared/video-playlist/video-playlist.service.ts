import { catchError, map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { RestExtractor } from '../rest/rest-extractor.service'
import { HttpClient } from '@angular/common/http'
import { ResultList } from '../../../../../shared'
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

@Injectable()
export class VideoPlaylistService {
  static BASE_VIDEO_PLAYLIST_URL = environment.apiUrl + '/api/v1/video-playlists/'

  constructor (
    private authHttp: HttpClient,
    private serverService: ServerService,
    private restExtractor: RestExtractor
  ) { }

  listChannelPlaylists (videoChannel: VideoChannel): Observable<ResultList<VideoPlaylist>> {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.nameWithHost + '/video-playlists'

    return this.authHttp.get<ResultList<VideoPlaylist>>(url)
               .pipe(
                 switchMap(res => this.extractPlaylists(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  listAccountPlaylists (account: Account): Observable<ResultList<VideoPlaylist>> {
    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-playlists'

    return this.authHttp.get<ResultList<VideoPlaylist>>(url)
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

    return this.authHttp.post(VideoPlaylistService.BASE_VIDEO_PLAYLIST_URL, data)
               .pipe(
                 map(this.restExtractor.extractDataBool),
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
}
