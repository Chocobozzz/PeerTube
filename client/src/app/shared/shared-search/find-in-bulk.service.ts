import * as debug from 'debug'
import { Observable, Subject } from 'rxjs'
import { filter, first, map } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { buildBulkObservable } from '@app/helpers'
import { ResultList } from '@shared/models/common'
import { Video, VideoChannel } from '../shared-main'
import { VideoPlaylist } from '../shared-video-playlist'
import { SearchService } from './search.service'
import { AdvancedSearch } from './advanced-search.model'

const debugLogger = debug('peertube:search:FindInBulkService')

type BulkObservables <P extends number | string, R> = {
  notifier: Subject<P>
  result: Observable<{ params: P[], response: R }>
}

@Injectable()
export class FindInBulkService {

  private advancedSearchForBulk: AdvancedSearch

  private getVideoInBulk: BulkObservables<string, ResultList<Video>>
  private getChannelInBulk: BulkObservables<string, ResultList<VideoChannel>>
  private getPlaylistInBulk: BulkObservables<string, ResultList<VideoPlaylist>>

  constructor (
    private searchService: SearchService
  ) {
    this.getVideoInBulk = this.buildBulkObservableObject(this.getVideosInBulk.bind(this))
    this.getChannelInBulk = this.buildBulkObservableObject(this.getChannelsInBulk.bind(this))
    this.getPlaylistInBulk = this.buildBulkObservableObject(this.getPlaylistsInBulk.bind(this))

    this.advancedSearchForBulk = new AdvancedSearch({ searchTarget: 'local' })
  }

  getVideo (uuid: string): Observable<Video> {
    debugLogger('Schedule video fetch for uuid %s.', uuid)

    return this.getData({
      observableObject: this.getVideoInBulk,
      finder: v => v.uuid === uuid || v.shortUUID === uuid,
      param: uuid
    })
  }

  getChannel (handle: string): Observable<VideoChannel> {
    debugLogger('Schedule channel fetch for handle %s.', handle)

    return this.getData({
      observableObject: this.getChannelInBulk,
      finder: c => c.nameWithHost === handle || c.nameWithHostForced === handle,
      param: handle
    })
  }

  getPlaylist (uuid: string): Observable<VideoPlaylist> {
    debugLogger('Schedule playlist fetch for uuid %s.', uuid)

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
        .subscribe({
          next: result => {
            if (!result) {
              obs.error(new Error($localize`Element ${param} not found`))
              return
            }

            obs.next(result)
            obs.complete()
          },

          error: err => obs.error(err)
        })

      observableObject.notifier.next(param)
    })
  }

  private getVideosInBulk (uuids: string[]) {
    debugLogger('Fetching videos %s.', uuids.join(', '))

    return this.searchService.searchVideos({
      uuids,
      componentPagination: { itemsPerPage: uuids.length, currentPage: 1 },
      advancedSearch: this.advancedSearchForBulk
    })
  }

  private getChannelsInBulk (handles: string[]) {
    debugLogger('Fetching channels %s.', handles.join(', '))

    return this.searchService.searchVideoChannels({
      handles,
      componentPagination: { itemsPerPage: handles.length, currentPage: 1 },
      advancedSearch: this.advancedSearchForBulk
    })
  }

  private getPlaylistsInBulk (uuids: string[]) {
    debugLogger('Fetching playlists %s.', uuids.join(', '))

    return this.searchService.searchVideoPlaylists({
      uuids,
      componentPagination: { itemsPerPage: uuids.length, currentPage: 1 },
      advancedSearch: this.advancedSearchForBulk
    })
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
