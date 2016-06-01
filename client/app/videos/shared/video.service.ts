import { Injectable } from '@angular/core';
import { Http, Response, URLSearchParams } from '@angular/http';
import { Observable } from 'rxjs/Rx';

import { Pagination } from './pagination.model';
import { Search } from '../../shared/index';
import { SortField } from './sort-field.type';
import { AuthService } from '../../shared/index';
import { Video } from './video.model';

@Injectable()
export class VideoService {
  private static BASE_VIDEO_URL = '/api/v1/videos/';

  constructor(
    private authService: AuthService,
    private http: Http
  ) {}

  getVideo(id: string) {
    return this.http.get(VideoService.BASE_VIDEO_URL + id)
                    .map(res => <Video> res.json())
                    .catch(this.handleError);
  }

  getVideos(pagination: Pagination, sort: SortField) {
    const params = this.createPaginationParams(pagination);

    if (sort) params.set('sort', sort);

    return this.http.get(VideoService.BASE_VIDEO_URL, { search: params })
                    .map(res => res.json())
                    .map(this.extractVideos)
                    .catch(this.handleError);
  }

  removeVideo(id: string) {
    const options = this.authService.getAuthRequestOptions();
    return this.http.delete(VideoService.BASE_VIDEO_URL + id, options)
                    .map(res => <number> res.status)
                    .catch(this.handleError);
  }

  searchVideos(search: Search, pagination: Pagination, sort: SortField) {
    const params = this.createPaginationParams(pagination);

    if (search.field) params.set('field', search.field);
    if (sort) params.set('sort', sort);

    return this.http.get(VideoService.BASE_VIDEO_URL + 'search/' + encodeURIComponent(search.value), { search: params })
                    .map(res => res.json())
                    .map(this.extractVideos)
                    .catch(this.handleError);
  }

  private createPaginationParams(pagination: Pagination) {
    const params = new URLSearchParams();
    const start: number = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const count: number = pagination.itemsPerPage;

    params.set('start', start.toString());
    params.set('count', count.toString());

    return params;
  }

  private extractVideos(body: any) {
    const videos_json = body.data;
    const totalVideos = body.total;
    const videos = [];
    for (const video_json of videos_json) {
      videos.push(new Video(video_json));
    }

    return { videos, totalVideos };
  }

  private handleError(error: Response) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
