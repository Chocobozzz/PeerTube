import { Injectable } from '@angular/core'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { RestExtractor } from '../rest/rest-extractor.service'
import { RestService } from '../rest/rest.service'
import { HttpClient } from '@angular/common/http'
import { VideoChannel as VideoChannelServer, VideoChannelCreate, VideoChannelUpdate } from '../../../../../shared/models/videos'
import { AccountService } from '../account/account.service'
import { ResultList } from '../../../../../shared'
import { VideoChannel } from './video-channel.model'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import { environment } from '../../../environments/environment'
import { UserService } from '@app/+admin/users/shared/user.service'
import { User } from '@app/shared'

@Injectable()
export class VideoChannelService {
  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channels/'

  videoChannelLoaded = new ReplaySubject<VideoChannel>(1)

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  getVideoChannel (videoChannelUUID: string) {
    return this.authHttp.get<VideoChannel>(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelUUID)
               .map(videoChannelHash => new VideoChannel(videoChannelHash))
               .do(videoChannel => this.videoChannelLoaded.next(videoChannel))
               .catch((res) => this.restExtractor.handleError(res))
  }

  listAccountVideoChannels (accountId: number): Observable<ResultList<VideoChannel>> {
    return this.authHttp.get<ResultList<VideoChannelServer>>(AccountService.BASE_ACCOUNT_URL + accountId + '/video-channels')
               .map(res => this.extractVideoChannels(res))
               .catch((res) => this.restExtractor.handleError(res))
  }

  createVideoChannel (videoChannel: VideoChannelCreate) {
    return this.authHttp.post(VideoChannelService.BASE_VIDEO_CHANNEL_URL, videoChannel)
               .map(this.restExtractor.extractDataBool)
               .catch(err => this.restExtractor.handleError(err))
  }

  updateVideoChannel (videoChannelUUID: string, videoChannel: VideoChannelUpdate) {
    return this.authHttp.put(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelUUID, videoChannel)
               .map(this.restExtractor.extractDataBool)
               .catch(err => this.restExtractor.handleError(err))
  }

  removeVideoChannel (videoChannel: VideoChannel) {
    return this.authHttp.delete(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.uuid)
               .map(this.restExtractor.extractDataBool)
               .catch(err => this.restExtractor.handleError(err))
  }

  private extractVideoChannels (result: ResultList<VideoChannelServer>) {
    const videoChannels: VideoChannel[] = []

    for (const videoChannelJSON of result.data) {
      videoChannels.push(new VideoChannel(videoChannelJSON))
    }

    return { data: videoChannels, total: result.total }
  }
}
