import { Observable, ReplaySubject } from 'rxjs'
import { catchError, map, tap } from 'rxjs/operators'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight, RestExtractor, RestService, ServerService } from '@app/core'
import {
  ActorImage,
  ResultList,
  VideoChannel as VideoChannelServer,
  VideoChannelCreate,
  VideoChannelUpdate,
  VideosImportInChannelCreate
} from '@peertube/peertube-models'
import { environment } from '../../../../environments/environment'
import { AccountService } from '../account/account.service'
import { VideoChannel } from './video-channel.model'
import { Account } from '../account/account.model'

@Injectable({ providedIn: 'root' })
export class VideoChannelService {
  static BASE_VIDEO_CHANNEL_URL = environment.apiUrl + '/api/v1/video-channels/'

  videoChannelLoaded = new ReplaySubject<VideoChannel>(1)

  constructor (
    private authHttp: HttpClient,
    private restService: RestService,
    private restExtractor: RestExtractor,
    private serverService: ServerService
  ) { }

  static extractVideoChannels (result: ResultList<VideoChannelServer>) {
    const videoChannels: VideoChannel[] = []

    for (const videoChannelJSON of result.data) {
      videoChannels.push(new VideoChannel(videoChannelJSON))
    }

    return { data: videoChannels, total: result.total }
  }

  getVideoChannel (videoChannelName: string) {
    return this.authHttp.get<VideoChannel>(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName)
               .pipe(
                 map(videoChannelHash => new VideoChannel(videoChannelHash)),
                 tap(videoChannel => this.videoChannelLoaded.next(videoChannel)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  listAccountVideoChannels (options: {
    account: Account
    componentPagination?: ComponentPaginationLight
    withStats?: boolean
    sort?: string
    search?: string
  }): Observable<ResultList<VideoChannel>> {
    const { account, componentPagination, withStats = false, sort, search } = options

    const defaultCount = Math.min(this.serverService.getHTMLConfig().videoChannels.maxPerUser, 100) // 100 is the max count on server side

    const pagination = componentPagination
      ? this.restService.componentToRestPagination(componentPagination)
      : { start: 0, count: defaultCount }

    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)
    params = params.set('withStats', withStats + '')

    if (search) params = params.set('search', search)

    const url = AccountService.BASE_ACCOUNT_URL + account.nameWithHost + '/video-channels'
    return this.authHttp.get<ResultList<VideoChannelServer>>(url, { params })
               .pipe(
                 map(res => VideoChannelService.extractVideoChannels(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  createVideoChannel (videoChannel: VideoChannelCreate) {
    return this.authHttp.post(VideoChannelService.BASE_VIDEO_CHANNEL_URL, videoChannel)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  updateVideoChannel (videoChannelName: string, videoChannel: VideoChannelUpdate) {
    return this.authHttp.put(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName, videoChannel)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  changeVideoChannelImage (videoChannelName: string, avatarForm: FormData, type: 'avatar' | 'banner') {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName + '/' + type + '/pick'

    return this.authHttp.post<{ avatars?: ActorImage[], banners?: ActorImage[] }>(url, avatarForm)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteVideoChannelImage (videoChannelName: string, type: 'avatar' | 'banner') {
    const url = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName + '/' + type

    return this.authHttp.delete(url)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  removeVideoChannel (videoChannel: VideoChannel) {
    return this.authHttp.delete(VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannel.nameWithHost)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  importVideos (videoChannelName: string, externalChannelUrl: string, syncId?: number) {
    const path = VideoChannelService.BASE_VIDEO_CHANNEL_URL + videoChannelName + '/import-videos'

    const body: VideosImportInChannelCreate = {
      externalChannelUrl,
      videoChannelSyncId: syncId
    }

    return this.authHttp.post(path, body)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
