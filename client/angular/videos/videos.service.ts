import { Injectable } from '@angular/core';
import { Http, Response, RequestOptions, URLSearchParams } from '@angular/http';
import { Observable } from 'rxjs/Rx';

import { Pagination } from './pagination';
import { Video } from './video';
import { AuthService } from '../users/services/auth.service';

@Injectable()
export class VideosService {
  private _baseVideoUrl = '/api/v1/videos/';

  constructor (private http: Http, private _authService: AuthService) {}

  getVideos(pagination: Pagination) {
    const params = { search: this.createPaginationParams(pagination) };
    return this.http.get(this._baseVideoUrl, params)
                    .map(res => res.json())
                    .map(this.extractVideos)
                    .catch(this.handleError);
  }

  getVideo(id: string) {
    return this.http.get(this._baseVideoUrl + id)
                    .map(res => <Video> res.json())
                    .catch(this.handleError);
  }

  removeVideo(id: string) {
    const options = this._authService.getAuthRequestOptions();
    return this.http.delete(this._baseVideoUrl + id, options)
                    .map(res => <number> res.status)
                    .catch(this.handleError);
  }

  searchVideos(search: string, pagination: Pagination) {
    const params = { search: this.createPaginationParams(pagination) };
    return this.http.get(this._baseVideoUrl + 'search/' + encodeURIComponent(search), params)
                    .map(res => res.json())
                    .map(this.extractVideos)
                    .catch(this.handleError);
  }

  private extractVideos (body: any) {
    const videos_json = body.data;
    const totalVideos = body.total;
    const videos = [];
    for (const video_json of videos_json) {
      videos.push(new Video(video_json));
    }

    return { videos, totalVideos };
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }

  private createPaginationParams(pagination: Pagination) {
    const params = new URLSearchParams();
    const start: number = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const count: number = pagination.itemsPerPage;

    params.set('start', start.toString());
    params.set('count', count.toString());

    return params;
  }
}
