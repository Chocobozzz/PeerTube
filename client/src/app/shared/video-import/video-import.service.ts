import { catchError, map, switchMap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { VideoImport } from '../../../../../shared'
import { environment } from '../../../environments/environment'
import { RestExtractor, RestService } from '../rest'
import { VideoImportCreate } from '../../../../../shared/models/videos/video-import-create.model'
import { objectToFormData } from '@app/shared/misc/utils'
import { VideoUpdate } from '../../../../../shared/models/videos'
import { ResultList } from '../../../../../shared/models/result-list.model'
import { UserService } from '@app/shared/users/user.service'
import { SortMeta } from 'primeng/components/common/sortmeta'
import { RestPagination } from '@app/shared/rest'
import { ServerService } from '@app/core'
import { peertubeTranslate } from '@app/shared/i18n/i18n-utils'

@Injectable()
export class VideoImportService {
  private static BASE_VIDEO_IMPORT_URL = environment.apiUrl + '/api/v1/videos/imports/'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor,
    private serverService: ServerService
  ) {}

  importVideo (targetUrl: string, video: VideoUpdate): Observable<VideoImport> {
    const url = VideoImportService.BASE_VIDEO_IMPORT_URL
    const language = video.language || null
    const licence = video.licence || null
    const category = video.category || null
    const description = video.description || null
    const support = video.support || null
    const scheduleUpdate = video.scheduleUpdate || null

    const body: VideoImportCreate = {
      targetUrl,

      name: video.name,
      category,
      licence,
      language,
      support,
      description,
      channelId: video.channelId,
      privacy: video.privacy,
      tags: video.tags,
      nsfw: video.nsfw,
      waitTranscoding: video.waitTranscoding,
      commentsEnabled: video.commentsEnabled,
      thumbnailfile: video.thumbnailfile,
      previewfile: video.previewfile,
      scheduleUpdate
    }

    const data = objectToFormData(body)
    return this.authHttp.post<VideoImport>(url, data)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getMyVideoImports (pagination: RestPagination, sort: SortMeta): Observable<ResultList<VideoImport>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp
               .get<ResultList<VideoImport>>(UserService.BASE_USERS_URL + '/me/videos/imports', { params })
               .pipe(
                 switchMap(res => this.extractVideoImports(res)),
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  private extractVideoImports (result: ResultList<VideoImport>): Observable<ResultList<VideoImport>> {
    return this.serverService.localeObservable
               .pipe(
                 map(translations => {
                   result.data.forEach(d =>
                     d.state.label = peertubeTranslate(d.state.label, translations)
                   )

                   return result
                 })
               )
  }
}
