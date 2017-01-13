import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

import { Search } from '../../shared';
import { SortField } from './sort-field.type';
import { AuthService } from '../../core';
import { AuthHttp, RestExtractor, RestPagination, RestService, ResultList } from '../../shared';
import { Video } from './video.model';

@Injectable()
export class VideoService {
  private static BASE_VIDEO_URL = '/api/v1/videos/';

  constructor(
    private authService: AuthService,
    private authHttp: AuthHttp,
    private http: Http,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  getVideo(id: string): Observable<Video> {
    return this.http.get(VideoService.BASE_VIDEO_URL + id)
                    .map(this.restExtractor.extractDataGet)
                    .map(video_hash => new Video(video_hash))
                    .catch((res) => this.restExtractor.handleError(res));
  }

  getVideos(pagination: RestPagination, sort: SortField) {
    const params = this.restService.buildRestGetParams(pagination, sort);

    return this.http.get(VideoService.BASE_VIDEO_URL, { search: params })
                    .map(res => res.json())
                    .map(this.extractVideos)
                    .catch((res) => this.restExtractor.handleError(res));
  }

  removeVideo(id: string) {
    return this.authHttp.delete(VideoService.BASE_VIDEO_URL + id)
                        .map(this.restExtractor.extractDataBool)
                        .catch((res) => this.restExtractor.handleError(res));
  }

  searchVideos(search: Search, pagination: RestPagination, sort: SortField) {
    const params = this.restService.buildRestGetParams(pagination, sort);

    if (search.field) params.set('field', search.field);

    return this.http.get(VideoService.BASE_VIDEO_URL + 'search/' + encodeURIComponent(search.value), { search: params })
                    .map(this.restExtractor.extractDataList)
                    .map(this.extractVideos)
                    .catch((res) => this.restExtractor.handleError(res));
  }

  private extractVideos(result: ResultList) {
    const videosJson = result.data;
    const totalVideos = result.total;
    const videos = [];
    for (const videoJson of videosJson) {
      videos.push(new Video(videoJson));
    }

    return { videos, totalVideos };
  }
}
