import * as debug from 'debug'
import { Observable, Subject } from 'rxjs'
import { filter, first, map } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { buildBulkObservable } from '@app/helpers'
import { ResultList } from '@shared/models/common'
import { Video, VideoChannel } from '../shared-main'
import { VideoPlaylist } from '../shared-video-playlist'
import { SearchService } from './search.service'

const logger = debug('peertube:search:FindInBulkService')

type BulkObservables <P extends number | string, R> = {
  notifier: Subject<P>
  result: Observable<{ params: P[], response: R }>
}

@Injectable()
export class FindInBulkService {

  private getVideoInBulk: BulkObservables<string, ResultList<Video>>
  private getChannelInBulk: BulkObservables<string, ResultList<VideoChannel>>
  private getPlaylistInBulk: BulkObservables<string, ResultList<VideoPlaylist>>

  constructor (
    private searchService: SearchService
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
          filter(result => result.params.includes(param)),
          first(),
          map(result => result.response.data),
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

    return this.searchService.searchVideos({ uuids, componentPagination: { itemsPerPage: uuids.length, currentPage: 1 } })
  }

  private getChannelsInBulk (handles: string[]) {
    logger('Fetching channels %s.', handles.join(', '))

    return this.searchService.searchVideoChannels({ handles, componentPagination: { itemsPerPage: handles.length, currentPage: 1 } })
  }

  private getPlaylistsInBulk (uuids: string[]) {
    logger('Fetching playlists %s.', uuids.join(', '))

    return this.searchService.searchVideoPlaylists({ uuids, componentPagination: { itemsPerPage: uuids.length, currentPage: 1 } })
  }

  private buildBulkObservableObject <P extends number | string, R> (bulkGet: (params: P[]) => Observable<R>) {
    const notifier = new Subject<P>()

    return {
      notifier,

      result: buildBulkObservable({
        time: 500,
        bulkGet,
        notifierObservable: notifier.asObservable()
      })
    }
  }
}
