import { catchError, map, tap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { Observable, ReplaySubject } from 'rxjs'
import { RestExtractor } from '../rest/rest-extractor.service'
import { HttpClient } from '@angular/common/http'
import { VideoChannel as VideoChannelServer, VideoChannelCreate, VideoChannelUpdate } from '../../../../../shared/models/videos'
import { AccountService } from '../account/account.service'
import { ResultList } from '../../../../../shared'
import { VideoChannel } from './video-channel.model'
import { environment } from '../../../environments/environment'
import { Account } from '@app/shared/account/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'

@Injectable()
export class VideoChannelService {
  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channels/'

  videoChannelLoaded = new ReplaySubject<VideoChannel>(1)

  static extractVideoChannels (result: ResultList<VideoChannelServer>) {
    const videoChannels: VideoChannel[] = []

    for (const videoChannelJSON of result.data) {
      videoChannels.push(new VideoChannel(videoChannelJSON))
    }

    return { data: videoChannels, total: result.total }
  }

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) { }

  getVideoChannel (videoChannelName: string) {
    return this.authHttp.get<VideoChannel>(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName)
               .pipe(
                 map(videoChannelHash => new VideoChannel(videoChannelHash)),
                 tap(videoChannel => this.videoChannelLoaded.next(videoChannel)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  listAccountVideoChannels (account: Account): Observable<ResultList<VideoChannel>> {
    return this.authHttp.get<ResultList<VideoChannelServer>>(AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-channels')
               .pipe(
                 map(res => VideoChannelService.extractVideoChannels(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  createVideoChannel (videoChannel: VideoChannelCreate) {
    return this.authHttp.post(VideoChannelService.BASE_VIDEO_CHANNEL_URL, videoChannel)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateVideoChannel (videoChannelName: string, videoChannel: VideoChannelUpdate) {
    return this.authHttp.put(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName, videoChannel)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  changeVideoChannelAvatar (videoChannelName: string, avatarForm: FormData) {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName + '/avatar/pick'

    return this.authHttp.post<{ avatar: Avatar }>(url, avatarForm)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  removeVideoChannel (videoChannel: VideoChannel) {
    return this.authHttp.delete(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.uuid)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }
}
