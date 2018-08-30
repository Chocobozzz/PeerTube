import { catchError, map, switchMap, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { forkJoin, Observable, of } from 'rxjs'
import { VideosOverview as VideosOverviewServer, peertubeTranslate } from '../../../../../shared/models'
import { environment } from '../../../environments/environment'
import { RestExtractor } from '../rest/rest-extractor.service'
import { RestService } from '../rest/rest.service'
import { VideosOverview } from '@app/shared/overview/videos-overview.model'
import { VideoService } from '@app/shared/video/video.service'
import { ServerService } from '@app/core'
import { immutableAssign } from '@app/shared/misc/utils'

@Injectable()
export class OverviewService {
  static BASE_OVERVIEW_URL = environment.apiUrl + '/api/v1/overviews/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService,
    private videosService: VideoService,
    private serverService: ServerService
  ) {}

  getVideosOverview (): Observable<VideosOverview> {
    return this.authHttp
               .get<VideosOverviewServer>(OverviewService.BASE_OVERVIEW_URL + 'videos')
               .pipe(
                 switchMap(serverVideosOverview => this.updateVideosOverview(serverVideosOverview)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  private updateVideosOverview (serverVideosOverview: VideosOverviewServer): Observable<VideosOverview> {
    const observables: Observable<any>[] = []
    const videosOverviewResult: VideosOverview = {
      tags: [],
      categories: [],
      channels: []
    }

    // Build videos objects
    for (const key of Object.keys(serverVideosOverview)) {
      for (const object of serverVideosOverview[ key ]) {
        observables.push(
          of(object.videos)
            .pipe(
              switchMap(videos => this.videosService.extractVideos({ total: 0, data: videos })),
              map(result => result.videos),
              tap(videos => {
                videosOverviewResult[key].push(immutableAssign(object, { videos }))
              })
            )
        )
      }
    }

    return forkJoin(observables)
      .pipe(
        // Translate categories
        switchMap(() => {
          return this.serverService.localeObservable
              .pipe(
                tap(translations => {
                  for (const c of videosOverviewResult.categories) {
                    c.category.label = peertubeTranslate(c.category.label, translations)
                  }
                })
              )
        }),
        map(() => videosOverviewResult)
      )
  }

}
