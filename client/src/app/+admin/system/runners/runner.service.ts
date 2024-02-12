import { SortMeta } from 'primeng/api'
import { catchError, concatMap, forkJoin, from, map, toArray } from 'rxjs'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService, ServerService } from '@app/core'
import { arrayify, peertubeTranslate } from '@peertube/peertube-core-utils'
import { ResultList, Runner, RunnerJob, RunnerJobAdmin, RunnerJobState, RunnerRegistrationToken } from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'

export type RunnerJobFormatted = RunnerJob & {
  payload: string
  privatePayload: string
}

@Injectable()
export class RunnerService {
  private static BASE_RUNNER_URL = environment.apiUrl + '/api/v1/runners'

  constructor (
    private authHttp: HttpClient,
    private server: ServerService,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {}

  listRegistrationTokens (options: {
    pagination: RestPagination
    sort: SortMeta
  }) {
    const { pagination, sort } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<RunnerRegistrationToken>>(RunnerService.BASE_RUNNER_URL + '/registration-tokens', { params })
                .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  generateToken () {
    return this.authHttp.post(RunnerService.BASE_RUNNER_URL + '/registration-tokens/generate', {})
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  removeToken (token: RunnerRegistrationToken) {
    return this.authHttp.delete(RunnerService.BASE_RUNNER_URL + '/registration-tokens/' + token.id)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  // ---------------------------------------------------------------------------

  listRunnerJobs (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
  }) {
    const { pagination, sort, search } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      params = this.buildParamsFromSearch(search, params)
    }

    return forkJoin([
      this.authHttp.get<ResultList<RunnerJobAdmin>>(RunnerService.BASE_RUNNER_URL + '/jobs', { params }),
      this.server.getServerLocale()
    ]).pipe(
      map(([ res, translations ]) => {
        const newData = res.data.map(job => {
          return {
            ...job,

            state: {
              id: job.state.id,
              label: peertubeTranslate(job.state.label, translations)
            },
            payload: JSON.stringify(job.payload, null, 2),
            privatePayload: JSON.stringify(job.privatePayload, null, 2)
          } as RunnerJobFormatted
        })

        return {
          total: res.total,
          data: newData
        }
      }),
      map(res => this.restExtractor.convertResultListDateToHuman(res, [ 'createdAt', 'startedAt', 'finishedAt' ], 'precise')),
      catchError(res => this.restExtractor.handleError(res))
    )
  }

  private buildParamsFromSearch (search: string, params: HttpParams) {
    const filters = this.restService.parseQueryStringFilter(search, {
      stateOneOf: {
        prefix: 'state:',
        multiple: true,
        handler: v => {
          if (v === 'completed') return RunnerJobState.COMPLETED
          if (v === 'processing') return RunnerJobState.PROCESSING
          if (v === 'errored') return RunnerJobState.ERRORED
          if (v === 'pending') return RunnerJobState.PENDING
          if (v === 'waiting-for-parent-job') return RunnerJobState.WAITING_FOR_PARENT_JOB
          if (v === 'parent-errored') return RunnerJobState.PARENT_ERRORED

          return undefined
        }
      }
    })

    return this.restService.addObjectParams(params, filters)
  }

  // ---------------------------------------------------------------------------

  cancelJobs (jobsArg: RunnerJob | RunnerJob[]) {
    const jobs = arrayify(jobsArg)

    return from(jobs)
      .pipe(
        concatMap(job => this.authHttp.post(RunnerService.BASE_RUNNER_URL + '/jobs/' + job.uuid + '/cancel', {})),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  removeJobs (jobsArg: RunnerJob | RunnerJob[]) {
    const jobs = arrayify(jobsArg)

    return from(jobs)
      .pipe(
        concatMap(job => this.authHttp.delete(RunnerService.BASE_RUNNER_URL + '/jobs/' + job.uuid)),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  // ---------------------------------------------------------------------------

  listRunners (options: {
    pagination: RestPagination
    sort: SortMeta
  }) {
    const { pagination, sort } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<Runner>>(RunnerService.BASE_RUNNER_URL + '/', { params })
                .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  deleteRunner (runner: Runner) {
    return this.authHttp.delete(RunnerService.BASE_RUNNER_URL + '/' + runner.id)
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }
}
