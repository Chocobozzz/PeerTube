import { SortMeta } from 'primeng/api'
import { Observable } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor, RestPagination, RestService } from '@app/core'
import { ActivityPubActorType, ActorFollow, FollowState, ResultList } from '@shared/models'
import { environment } from '../../../environments/environment'

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
    pagination: RestPagination,
    sort: SortMeta,
    search?: string,
    actorType?: ActivityPubActorType,
    state?: FollowState
  }): Observable<ResultList<ActorFollow>> {
    const { pagination, sort, search, state, actorType } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) params = params.append('search', search)
    if (state) params = params.append('state', state)
    if (actorType) params = params.append('actorType', actorType)

    return this.authHttp.get<ResultList<ActorFollow>>(InstanceFollowService.BASE_APPLICATION_URL + '/following', { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  getFollowers (options: {
    pagination: RestPagination,
    sort: SortMeta,
    search?: string,
    actorType?: ActivityPubActorType,
    state?: FollowState
  }): Observable<ResultList<ActorFollow>> {
    const { pagination, sort, search, state, actorType } = options

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    if (search) params = params.append('search', search)
    if (state) params = params.append('state', state)
    if (actorType) params = params.append('actorType', actorType)

    return this.authHttp.get<ResultList<ActorFollow>>(InstanceFollowService.BASE_APPLICATION_URL + '/followers', { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  follow (notEmptyHosts: string[]) {
    const body = {
      hosts: notEmptyHosts
    }

    return this.authHttp.post(InstanceFollowService.BASE_APPLICATION_URL + '/following', body)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  unfollow (follow: ActorFollow) {
    return this.authHttp.delete(InstanceFollowService.BASE_APPLICATION_URL + '/following/' + follow.following.host)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  acceptFollower (follow: ActorFollow) {
    const handle = follow.follower.name + '@' + follow.follower.host

    return this.authHttp.post(`${InstanceFollowService.BASE_APPLICATION_URL}/followers/${handle}/accept`, {})
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  rejectFollower (follow: ActorFollow) {
    const handle = follow.follower.name + '@' + follow.follower.host

    return this.authHttp.post(`${InstanceFollowService.BASE_APPLICATION_URL}/followers/${handle}/reject`, {})
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }

  removeFollower (follow: ActorFollow) {
    const handle = follow.follower.name + '@' + follow.follower.host

    return this.authHttp.delete(`${InstanceFollowService.BASE_APPLICATION_URL}/followers/${handle}`)
               .pipe(
                 map(this.restExtractor.extractDataBool),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }
}
