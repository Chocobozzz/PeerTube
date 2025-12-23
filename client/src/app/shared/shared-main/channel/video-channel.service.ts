import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestService, ServerService } from '@app/core'
import {
  ActorImage,
  ResultList,
  VideoChannelActivity,
  VideoChannelCollaborator,
  VideoChannelCreate,
  VideoChannel as VideoChannelServer,
  VideoChannelUpdate,
  VideosImportInChannelCreate
} from '@peertube/peertube-models'
import { Observable, ReplaySubject } from 'rxjs'
import { catchError, map, tap } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'
import { Account } from '../account/account.model'
import { AccountService } from '../account/account.service'
import { VideoChannel } from './video-channel.model'

@Injectable({ providedIn: 'root' })
export class VideoChannelService {
  private authHttp = inject(HttpClient)
  private restService = inject(RestService)
  private restExtractor = inject(RestExtractor)
  private serverService = inject(ServerService)

  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channels/'

  videoChannelLoaded = new ReplaySubject<VideoChannel>(1)

  static extractVideoChannels (result: ResultList<VideoChannelServer>) {
    const videoChannels: VideoChannel[] = []

    for (const videoChannelJSON of result.data) {
      videoChannels.push(new VideoChannel(videoChannelJSON))
    }

    return { data: videoChannels, total: result.total }
  }

  get (name: string) {
    return this.authHttp.get<VideoChannel>(VideoChannelService.BASE_VIDEO_CHANNEL_URL + name)
      .pipe(
        map(videoChannelHash => new VideoChannel(videoChannelHash)),
        tap(videoChannel => this.videoChannelLoaded.next(videoChannel)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  listAccountChannels (options: {
    account: Account
    componentPagination?: ComponentPaginationLight
    withStats?: boolean
    sort?: string
    search?: string
    includeCollaborations?: boolean
  }): Observable<ResultList<VideoChannel>> {
    const { account, componentPagination, withStats = false, sort, search, includeCollaborations = false } = options

    const defaultCount = Math.min(this.serverService.getHTMLConfig().videoChannels.maxPerUser, 100) // 100 is the max count on server side

    const pagination = componentPagination
      ? this.restService.componentToRestPagination(componentPagination)
      : { start: 0, count: defaultCount }

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = params.set('withStats', withStats + '')

    if (search) params = params.set('search', search)
    if (includeCollaborations) params = params.set('includeCollaborations', 'true')

    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-channels'
    return this.authHttp.get<ResultList<VideoChannelServer>>(url, { params })
      .pipe(
        map(res => VideoChannelService.extractVideoChannels(res)),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  create (channel: VideoChannelCreate) {
    return this.authHttp.post(VideoChannelService.BASE_VIDEO_CHANNEL_URL, channel)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  update (name: string, channel: VideoChannelUpdate) {
    return this.authHttp.put(VideoChannelService.BASE_VIDEO_CHANNEL_URL + name, channel)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  remove (channel: VideoChannel) {
    return this.authHttp.delete(VideoChannelService.BASE_VIDEO_CHANNEL_URL + channel.nameWithHost)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  changeImage (name: string, avatarForm: FormData, type: 'avatar' | 'banner') {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + name + '/' + type + '/pick'

    return this.authHttp.post<{ avatars?: ActorImage[], banners?: ActorImage[] }>(url, avatarForm)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteImage (name: string, type: 'avatar' | 'banner') {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + name + '/' + type

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  importVideos (name: string, externalChannelUrl: string, syncId?: number) {
    const path = VideoChannelService.BASE_VIDEO_CHANNEL_URL + name + '/import-videos'

    const body: VideosImportInChannelCreate = {
      externalChannelUrl,
      videoChannelSyncId: syncId
    }

    return this.authHttp.post(path, body)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  listCollaborators (channelName: string) {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + channelName + '/collaborators'

    return this.authHttp.get<ResultList<VideoChannelCollaborator>>(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  inviteCollaborator (channelName: string, collaboratorUsername: string) {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + channelName + '/collaborators/invite'

    return this.authHttp.post<{ collaborator: VideoChannelCollaborator }>(url, { accountHandle: collaboratorUsername })
      .pipe(
        map(({ collaborator }) => collaborator),
        catchError(err => this.restExtractor.handleError(err))
      )
  }

  acceptCollaboratorInvitation (channelName: string, collaboratorId: number) {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + channelName + '/collaborators/' + collaboratorId + '/accept'

    return this.authHttp.post(url, {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  rejectCollaboratorInvitation (channelName: string, collaboratorId: number) {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + channelName + '/collaborators/' + collaboratorId + '/reject'

    return this.authHttp.post(url, {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  removeCollaborator (channelName: string, collaboratorId: number) {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + channelName + '/collaborators/' + collaboratorId

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  listActivities (options: {
    channelName: string
    componentPagination: ComponentPaginationLight
  }) {
    const { channelName, componentPagination } = options

    const pagination = this.restService.componentToRestPagination(componentPagination)

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination)

    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + channelName + '/activities'
    return this.authHttp.get<ResultList<VideoChannelActivity>>(url, { params })
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
