import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { Job, ResultList } from '@peertube/peertube-models'
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

  listJobs (options: {
    jobStates?: JobStateClient[]
    jobType: JobTypeClient
    pagination: RestPagination
    sort: SortMeta
  }): Observable<ResultList<Job>> {
    const { jobStates, jobType, pagination, sort } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (jobType !== 'all') params = params.append('jobType', jobType)
    if (jobStates) params = params.append('states', jobStates.join(','))

    return this.authHttp.get<ResultList<Job>>(JobService.BASE_JOB_URL, { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res, [ 'createdAt', 'processedOn', 'finishedOn' ], 'precise')),
                 map(res => this.restExtractor.applyToResultListData(res, this.prettyPrintData.bind(this))),
                 map(res => this.restExtractor.applyToResultListData(res, this.buildUniqId.bind(this))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  listUnfinishedJobs (options: {
    jobType: JobTypeClient
    pagination: RestPagination
    sort: SortMeta
  }): Observable<ResultList<Job>> {
    return this.listJobs({
      ...options,
      jobStates: [ 'active', 'waiting', 'delayed', 'paused' ]
    })
  }

  private prettyPrintData (obj: Job) {
    const data = JSON.stringify(obj.data, null, 2)

    return Object.assign(obj, { data })
  }

  private buildUniqId (obj: Job) {
    return Object.assign(obj, { uniqId: `${obj.id}-${obj.type}` })
  }
}
