import * as debug from 'debug'
import { Observable, Subject } from 'rxjs'
import { first, map } from 'rxjs/operators'
import { Injectable, NgZone } from '@angular/core'
import { buildBulkObservable } from '@app/helpers'
import { ResultList } from '@shared/models/common'
import { Video, VideoChannel } from '../shared-main'
import { VideoPlaylist } from '../shared-video-playlist'
import { SearchService } from './search.service'

const logger = debug('peertube:search:FindInBulkService')

type BulkObservables <P extends number | string, R> = {
  notifier: Subject<P>
  result: Observable<R>
}

@Injectable()
export class FindInBulkService {

  private getVideoInBulk: BulkObservables<string, ResultList<Video>>
  private getChannelInBulk: BulkObservables<string, ResultList<VideoChannel>>
  private getPlaylistInBulk: BulkObservables<string, ResultList<VideoPlaylist>>

  constructor (
    private searchService: SearchService,
    private ngZone: NgZone
  ) {
    this.getVideoInBulk = this.buildBulkObservableObject(this.getVideosInBulk.bind(this))
    this.getChannelInBulk = this.buildBulkObservableObject(this.getChannelsInBulk.bind(this))
    this.getPlaylistInBulk = this.buildBulkObservableObject(this.getPlaylistsInBulk.bind(this))
  }

  getVideo (uuid: string): Observable<Video> {
    logger('Schedule video fetch for uuid %s.', uuid)

    return this.getData({
      observableObject: this.getVideoInBulk,
      finder: v => v.uuid === uuid,
      param: uuid
    })
  }

  getChannel (handle: string): Observable<VideoChannel> {
    logger('Schedule channel fetch for handle %s.', handle)

    return this.getData({
      observableObject: this.getChannelInBulk,
      finder: c => c.nameWithHost === handle || c.nameWithHostForced === handle,
      param: handle
    })
  }

  getPlaylist (uuid: string): Observable<VideoPlaylist> {
    logger('Schedule playlist fetch for uuid %s.', uuid)

    return this.getData({
      observableObject: this.getPlaylistInBulk,
      finder: p => p.uuid === uuid,
      param: uuid
    })
  }

  private getData <P extends number | string, R> (options: {
    observableObject: BulkObservables<P, ResultList<R>>
    param: P
    finder: (d: R) => boolean
  }) {
    const { observableObject, param, finder } = options

    return new Observable<R>(obs => {
      observableObject.result
        .pipe(
          first(),
          map(({ data }) => data),
          map(data => data.find(finder))
        )
        .subscribe(result => {
          if (!result) {
            obs.error(new Error($localize`Element ${param} not found`))
          } else {
            obs.next(result)
            obs.complete()
          }
        })

      observableObject.notifier.next(param)
    })
  }

  private getVideosInBulk (uuids: string[]) {
    logger('Fetching videos %s.', uuids.join(', '))

    return this.searchService.searchVideos({ uuids })
  }

  private getChannelsInBulk (handles: string[]) {
    logger('Fetching channels %s.', handles.join(', '))

    return this.searchService.searchVideoChannels({ handles })
  }

  private getPlaylistsInBulk (uuids: string[]) {
    logger('Fetching playlists %s.', uuids.join(', '))

    return this.searchService.searchVideoPlaylists({ uuids })
  }

  private buildBulkObservableObject <T extends number | string, R> (bulkGet: (params: T[]) => Observable<R>) {
    const notifier = new Subject<T>()

    return {
      notifier,

      result: buildBulkObservable({
        time: 500,
        bulkGet,
        ngZone: this.ngZone,
        notifierObservable: notifier.asObservable()
      })
    }
  }
}
