import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { SortMeta } from 'primeng/primeng'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { ResultList } from '../../../../../../shared'
import { JobState } from '../../../../../../shared/models'
import { Job } from '../../../../../../shared/models/job.model'
import { environment } from '../../../../environments/environment'
import { RestExtractor, RestPagination, RestService } from '../../../shared'

@Injectable()
export class JobService {
  private static BASE_JOB_URL = environment.apiUrl + '/api/v1/jobs'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  getJobs (state: JobState, pagination: RestPagination, sort: SortMeta): Observable<ResultList<Job>> {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<Job>>(JobService.BASE_JOB_URL + '/' + state, { params })
      .map(res => this.restExtractor.convertResultListDateToHuman(res, [ 'createdAt', 'updatedAt' ]))
      .map(res => this.restExtractor.applyToResultListData(res, this.prettyPrintData))
      .catch(err => this.restExtractor.handleError(err))
  }

  private prettyPrintData (obj: Job) {
    const data = JSON.stringify(obj.data, null, 2)

    return Object.assign(obj, { data })
  }
}
