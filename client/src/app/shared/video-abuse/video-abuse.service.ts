import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

import { AuthService } from '../core';
import { AuthHttp } from '../auth';
import { RestExtractor, ResultList } from '../rest';
import { VideoAbuse } from './video-abuse.model';

@Injectable()
export class VideoAbuseService {
  private static BASE_VIDEO_ABUSE_URL = '/api/v1/videos/';

  constructor(
    private authHttp: AuthHttp,
    private restExtractor: RestExtractor
  ) {}

  getVideoAbuses() {
    return this.authHttp.get(VideoAbuseService.BASE_VIDEO_ABUSE_URL + 'abuse')
                        .map(this.restExtractor.extractDataList)
                        .map(this.extractVideoAbuses)
  }

  reportVideo(id: string, reason: string) {
    const body = {
      reason
    };
    const url = VideoAbuseService.BASE_VIDEO_ABUSE_URL + id + '/abuse';

    return this.authHttp.post(url, body)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res));
  }

  private extractVideoAbuses(result: ResultList) {
    const videoAbuses: VideoAbuse[] = result.data;
    const totalVideoAbuses = result.total;

    return { videoAbuses, totalVideoAbuses };
  }
}
