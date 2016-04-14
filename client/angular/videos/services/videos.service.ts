import { Injectable } from 'angular2/core';
import { Http, Response } from 'angular2/http';
import { Observable } from 'rxjs/Rx';

import { Video } from '../models/video';
import { AuthService } from '../../users/services/auth.service';

@Injectable()
export class VideosService {
  private _baseVideoUrl = '/api/v1/videos/';

  constructor (private http: Http, private _authService: AuthService) {}

  getVideos() {
    return this.http.get(this._baseVideoUrl)
                    .map(res => <Video[]> res.json())
                    .catch(this.handleError);
  }

  getVideo(id: string) {
    return this.http.get(this._baseVideoUrl + id)
                    .map(res => <Video> res.json())
                    .catch(this.handleError);
  }

  removeVideo(id: string) {
    if (confirm('Are you sure?')) {
      const options = this._authService.getAuthRequestOptions();
      return this.http.delete(this._baseVideoUrl + id, options)
                      .map(res => <number> res.status)
                      .catch(this.handleError);
    }
  }

  searchVideos(search: string) {
    return this.http.get(this._baseVideoUrl + 'search/' + search)
                    .map(res => <Video> res.json())
                    .catch(this.handleError);
  }

  private handleError (error: Response) {
    console.error(error);
    return Observable.throw(error.json().error || 'Server error');
  }
}
