import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import {
  PlayerChannelSettings,
  PlayerChannelSettingsUpdate,
  PlayerVideoSettings,
  PlayerVideoSettingsUpdate
} from '@peertube/peertube-models'
import { catchError } from 'rxjs'
import { environment } from 'src/environments/environment'
import { VideoPasswordService } from '../shared-main/video/video-password.service'

@Injectable()
export class PlayerSettingsService {
  static BASE_PLAYER_SETTINGS_URL = environment.apiUrl + '/api/v1/player-settings/'

  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  getVideoSettings (options: {
    videoId: string
    videoPassword?: string
    raw: boolean
  }) {
    const headers = VideoPasswordService.buildVideoPasswordHeader(options.videoPassword)

    const path = PlayerSettingsService.BASE_PLAYER_SETTINGS_URL + 'videos/' + options.videoId

    let params = new HttpParams()
    if (options.raw) params = params.set('raw', 'true')

    return this.authHttp.get<PlayerVideoSettings>(path, { params, headers })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updateVideoSettings (options: {
    videoId: string
    settings: PlayerVideoSettingsUpdate
  }) {
    const path = PlayerSettingsService.BASE_PLAYER_SETTINGS_URL + 'videos/' + options.videoId

    return this.authHttp.put<PlayerVideoSettings>(path, options.settings)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  getChannelSettings (options: {
    channelHandle: string
    raw: boolean
  }) {
    const path = PlayerSettingsService.BASE_PLAYER_SETTINGS_URL + 'video-channels/' + options.channelHandle

    let params = new HttpParams()
    if (options.raw) params = params.set('raw', 'true')

    return this.authHttp.get<PlayerChannelSettings>(path, { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updateChannelSettings (options: {
    channelHandle: string
    settings: PlayerChannelSettingsUpdate
  }) {
    const path = PlayerSettingsService.BASE_PLAYER_SETTINGS_URL + 'video-channels/' + options.channelHandle

    return this.authHttp.put<PlayerChannelSettings>(path, options.settings)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
