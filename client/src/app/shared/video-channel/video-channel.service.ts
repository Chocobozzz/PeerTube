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

@Injectable()
export class VideoChannelService {
  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channels/'

  videoChannelLoaded = new ReplaySubject<VideoChannel>(1)

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  getVideoChannel (videoChannelUUID: string) {
    return this.authHttp.get<VideoChannel>(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelUUID)
               .pipe(
                 map(videoChannelHash => new VideoChannel(videoChannelHash)),
                 tap(videoChannel => this.videoChannelLoaded.next(videoChannel)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  listAccountVideoChannels (accountId: number): Observable<ResultList<VideoChannel>> {
    return this.authHttp.get<ResultList<VideoChannelServer>>(AccountService.BASE_ACCOUNT_URL + accountId + '/video-channels')
               .pipe(
                 map(res => this.extractVideoChannels(res)),
                 catchError((res) => this.restExtractor.handleError(res))
               )
  }

  createVideoChannel (videoChannel: VideoChannelCreate) {
    return this.authHttp.post(VideoChannelService.BASE_VIDEO_CHANNEL_URL, videoChannel)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  updateVideoChannel (videoChannelUUID: string, videoChannel: VideoChannelUpdate) {
    return this.authHttp.put(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelUUID, videoChannel)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  removeVideoChannel (videoChannel: VideoChannel) {
    return this.authHttp.delete(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.uuid)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  private extractVideoChannels (result: ResultList<VideoChannelServer>) {
    const videoChannels: VideoChannel[] = []

    for (const videoChannelJSON of result.data) {
      videoChannels.push(new VideoChannel(videoChannelJSON))
    }

    return { data: videoChannels, total: result.total }
  }
}
