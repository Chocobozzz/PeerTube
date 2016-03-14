import {Injectable} from 'angular2/core';
import {Http, Response} from 'angular2/http';
import {Observable} from 'rxjs/Rx';

import {Video} from '../models/video';

@Injectable()
export class VideosService {
  private _baseVideoUrl = '/api/v1/videos/';

  constructor (private http: Http) {}

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
      return this.http.delete(this._baseVideoUrl + id)
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
