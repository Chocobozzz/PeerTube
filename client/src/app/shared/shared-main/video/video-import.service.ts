import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService, ServerService, UserService } from '@app/core'
import { objectToFormData } from '@app/helpers'
import { peertubeTranslate } from '@peertube/peertube-core-utils'
import { ResultList, VideoImport, VideoImportCreate } from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError, map, switchMap } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'

@Injectable()
export class VideoImportService {
  private authHttp = inject(HttpClient)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)
  private serverService = inject(ServerService)

  private static BASE_VIDEO_IMPORT_URL = environment.apiUrl + '/api/v1/videos/imports/'

  importVideo (options: VideoImportCreate): Observable<VideoImport> {
    const url = VideoImportService.BASE_VIDEO_IMPORT_URL

    const data = objectToFormData(options)
    return this.authHttp.post<VideoImport>(url, data)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  listMyVideoImports (options: {
    pagination: RestPagination
    sort: SortMeta
    includeCollaborations: boolean
    search?: string
  }): Observable<ResultList<VideoImport>> {
    const { pagination, sort, search, includeCollaborations } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (includeCollaborations) params = params.append('includeCollaborations', 'true')

    if (search) {
      const filters = this.restService.parseQueryStringFilter(search, {
        id: {
          prefix: 'id:'
        },
        videoId: {
          prefix: 'videoId:'
        },
        videoChannelSyncId: {
          prefix: 'videoChannelSyncId:'
        },
        targetUrl: {
          prefix: 'targetUrl:'
        }
      })

      params = this.restService.addObjectParams(params, filters)
    }

    return this.authHttp
      .get<ResultList<VideoImport>>(UserService.BASE_USERS_URL + 'me/videos/imports', { params })
      .pipe(
        switchMap(res => this.extractVideoImports(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  deleteVideoImport (videoImport: VideoImport) {
    return this.authHttp.delete(VideoImportService.BASE_VIDEO_IMPORT_URL + videoImport.id)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  cancelVideoImport (videoImport: VideoImport) {
    return this.authHttp.post(VideoImportService.BASE_VIDEO_IMPORT_URL + videoImport.id + '/cancel', {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  retryVideoImport (videoImport: VideoImport) {
    return this.authHttp.post(VideoImportService.BASE_VIDEO_IMPORT_URL + videoImport.id + '/retry', {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  private extractVideoImports (result: ResultList<VideoImport>): Observable<ResultList<VideoImport>> {
    return this.serverService.getServerLocale()
      .pipe(
        map(translations => {
          result.data.forEach(d => d.state.label = peertubeTranslate(d.state.label, translations))

          return result
        })
      )
  }
}
