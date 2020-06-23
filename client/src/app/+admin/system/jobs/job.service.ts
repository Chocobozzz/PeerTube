import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { Job, ResultList } from '@shared/models'
import { environment } from '../../../../environments/environment'
import { JobStateClient } from '../../../../types/job-state-client.type'
import { JobTypeClient } from '../../../../types/job-type-client.type'

@Injectable()
export class JobService {
  private static BASE_JOB_URL = environment.apiUrl + '/api/v1/jobs'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getJobs (jobState: JobStateClient, jobType: JobTypeClient, pagination: RestPagination, sort: SortMeta): Observable<ResultList<Job>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (jobType !== 'all') params = params.append('jobType', jobType)

    return this.authHttp.get<ResultList<Job>>(JobService.BASE_JOB_URL + '/' + jobState, { params })
               .pipe(
                 map(res => {
                   return this.restExtractor.convertResultListDateToHuman(res, [ 'createdAt', 'processedOn', 'finishedOn' ])
                 }),
                 map(res => this.restExtractor.applyToResultListData(res, this.prettyPrintData)),
                 map(res => this.restExtractor.applyToResultListData(res, this.buildUniqId)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  private prettyPrintData (obj: Job) {
    const data = JSON.stringify(obj.data, null, 2)

    return Object.assign(obj, { data })
  }

  private buildUniqId (obj: Job) {
    return Object.assign(obj, { uniqId: `${obj.id}-${obj.type}` })
  }
}
