import { Injectable } from '@angular/core'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { RestExtractor } from '../rest/rest-extractor.service'
import { RestService } from '../rest/rest.service'
import { HttpClient } from '@angular/common/http'
import { VideoChannel as VideoChannelServer } from '../../../../../shared/models/videos'
import { AccountService } from '../account/account.service'
import { ResultList } from '../../../../../shared'
import { VideoChannel } from './video-channel.model'

@Injectable()
export class VideoChannelService {
  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  getVideoChannels (accountId: number): Observable<ResultList<VideoChannel>> {
    return this.authHttp.get<ResultList<VideoChannelServer>>(AccountService.BASE_ACCOUNT_URL + accountId + '/video-channels')
               .map(res => this.extractVideoChannels(res))
               .catch((res) => this.restExtractor.handleError(res))
  }

  private extractVideoChannels (result: ResultList<VideoChannelServer>) {
    const videoChannels: VideoChannel[] = []

    for (const videoChannelJSON of result.data) {
      videoChannels.push(new VideoChannel(videoChannelJSON))
    }

    return { data: videoChannels, total: result.total }
  }
}
