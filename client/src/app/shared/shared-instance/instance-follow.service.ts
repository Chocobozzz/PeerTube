import { SortMeta } from 'primeng/api'
import { from, Observable } from 'rxjs'
import { catchError, concatMap, toArray } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { arrayify } from '@peertube/peertube-core-utils'
import { ActivityPubActorType, ActorFollow, FollowState, ResultList, ServerFollowCreate } from '@peertube/peertube-models'
import { environment } from '../../../environments/environment'
import { AdvancedInputFilter } from '../shared-forms/advanced-input-filter.component'

@Injectable()
export class InstanceFollowService {
  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/server'

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor
  ) {
  }

  getFollowing (options: {
    pagination: RestPagination
    sort?: SortMeta
    search?: string
    actorType?: ActivityPubActorType
    state?: FollowState
  }): Observable<ResultList<ActorFollow>> {
    const { pagination, sort, search, state, actorType } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      params = this.restService.addObjectParams(params, this.parseFollowsListFilters(search))
    }

    if (state) params = params.append('state', state)
    if (actorType) params = params.append('actorType', actorType)

    return this.authHttp.get<ResultList<ActorFollow>>(InstanceFollowService.BASE_APPLICATION_URL + '/following', { params })
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  getFollowers (options: {
    pagination: RestPagination
    sort: SortMeta
    search?: string
    actorType?: ActivityPubActorType
    state?: FollowState
  }): Observable<ResultList<ActorFollow>> {
    const { pagination, sort, search, state, actorType } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) {
      params = this.restService.addObjectParams(params, this.parseFollowsListFilters(search))
    }

    if (state) params = params.append('state', state)
    if (actorType) params = params.append('actorType', actorType)

    return this.authHttp.get<ResultList<ActorFollow>>(InstanceFollowService.BASE_APPLICATION_URL + '/followers', { params })
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  follow (hostsOrHandles: string[]) {
    const body: ServerFollowCreate = {
      handles: hostsOrHandles.filter(v => v.includes('@')),
      hosts: hostsOrHandles.filter(v => !v.includes('@'))
    }

    return this.authHttp.post(InstanceFollowService.BASE_APPLICATION_URL + '/following', body)
               .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  unfollow (followsArg: ActorFollow[] | ActorFollow) {
    const follows = arrayify(followsArg)

    return from(follows)
      .pipe(
        concatMap(follow => {
          const handle = follow.following.name + '@' + follow.following.host

          return this.authHttp.delete(InstanceFollowService.BASE_APPLICATION_URL + '/following/' + handle)
        }),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  acceptFollower (followsArg: ActorFollow[] | ActorFollow) {
    const follows = arrayify(followsArg)

    return from(follows)
      .pipe(
        concatMap(follow => {
          const handle = follow.follower.name + '@' + follow.follower.host

          return this.authHttp.post(`${InstanceFollowService.BASE_APPLICATION_URL}/followers/${handle}/accept`, {})
        }),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  rejectFollower (followsArg: ActorFollow[] | ActorFollow) {
    const follows = arrayify(followsArg)

    return from(follows)
      .pipe(
        concatMap(follow => {
          const handle = follow.follower.name + '@' + follow.follower.host

          return this.authHttp.post(`${InstanceFollowService.BASE_APPLICATION_URL}/followers/${handle}/reject`, {})
        }),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  removeFollower (followsArg: ActorFollow[] | ActorFollow) {
    const follows = arrayify(followsArg)

    return from(follows)
      .pipe(
        concatMap(follow => {
          const handle = follow.follower.name + '@' + follow.follower.host

          return this.authHttp.delete(`${InstanceFollowService.BASE_APPLICATION_URL}/followers/${handle}`)
        }),
        toArray(),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  buildFollowsListFilters (): AdvancedInputFilter[] {
    return [
      {
        title: $localize`Advanced filters`,
        children: [
          {
            value: 'state:accepted',
            label: $localize`Accepted follows`
          },
          {
            value: 'state:rejected',
            label: $localize`Rejected follows`
          },
          {
            value: 'state:pending',
            label: $localize`Pending follows`
          }
        ]
      }
    ]
  }

  private parseFollowsListFilters (search: string) {
    return this.restService.parseQueryStringFilter(search, {
      state: {
        prefix: 'state:'
      }
    })
  }
}
