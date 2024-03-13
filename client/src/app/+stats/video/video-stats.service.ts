import { catchError } from 'rxjs'
import { environment } from 'src/environments/environment'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { VideoStatsOverall, VideoStatsRetention, VideoStatsTimeserie, VideoStatsTimeserieMetric } from '@peertube/peertube-models'
import { VideoService } from '@app/shared/shared-main/video/video.service'

@Injectable({
  providedIn: 'root'
})
export class VideoStatsService {
  static BASE_VIDEO_STATS_URL = environment.apiUrl + '/api/v1/videos/'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) { }

  getOverallStats (options: {
    videoId: string
    startDate?: Date
    endDate?: Date
  }) {
    const { videoId, startDate, endDate } = options

    let params = new HttpParams()
    if (startDate) params = params.append('startDate', startDate.toISOString())
    if (endDate) params = params.append('endDate', endDate.toISOString())

    return this.authHttp.get<VideoStatsOverall>(VideoService.BASE_VIDEO_URL + '/' + videoId + '/stats/overall', { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getTimeserieStats (options: {
    videoId: string
    metric: VideoStatsTimeserieMetric
    startDate?: Date
    endDate?: Date
  }) {
    const { videoId, metric, startDate, endDate } = options

    let params = new HttpParams()
    if (startDate) params = params.append('startDate', startDate.toISOString())
    if (endDate) params = params.append('endDate', endDate.toISOString())

    return this.authHttp.get<VideoStatsTimeserie>(VideoService.BASE_VIDEO_URL + '/' + videoId + '/stats/timeseries/' + metric, { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  getRetentionStats (videoId: string) {
    return this.authHttp.get<VideoStatsRetention>(VideoService.BASE_VIDEO_URL + '/' + videoId + '/stats/retention')
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
