import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, RestPagination, RestService, ServerService } from '@app/core'
import { arrayify, peertubeTranslate } from '@peertube/peertube-core-utils'
import {
  ResultList,
  Runner,
  RunnerJob,
  RunnerJobAdmin,
  RunnerJobStateType,
  RunnerJobType,
  RunnerRegistrationToken
} from '@peertube/peertube-models'
import { SortMeta } from 'primeng/api'
import { catchError, concatMap, forkJoin, from, map, toArray } from 'rxjs'
import { environment } from '../../../../environments/environment'

export type RunnerJobFormatted = RunnerJob & {
  payload: string
  privatePayload: string
}

@Injectable()
export class RunnerService {
  private authHttp = inject(HttpClient)
  private server = inject(ServerService)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)

  private static BASE_RUNNER_URL = environment.apiUrl + '/api/v1/runners'

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
    stateOneOf?: RunnerJobStateType[]
    typeOneOf?: RunnerJobType[]
  }) {
    const { pagination, sort, search, stateOneOf, typeOneOf } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) params = params.append('search', search)

    params = this.restService.addObjectParams(params, { stateOneOf, typeOneOf })

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
