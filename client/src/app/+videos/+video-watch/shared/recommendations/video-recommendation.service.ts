import { Injectable } from '@angular/core'
import { ServerService, UserService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { AdvancedSearch } from '@app/shared/shared-search/advanced-search.model'
import { SearchService } from '@app/shared/shared-search/search.service'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { Observable, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'

@Injectable()
export class VideoRecommendationService {
  private config: HTMLServerConfig

  private readonly videoIdsHistory = new Set<number>()

  constructor (
    private videos: VideoService,
    private searchService: SearchService,
    private userService: UserService,
    private serverService: ServerService
  ) {
    this.config = this.serverService.getHTMLConfig()
  }

  getRecommentationHistory () {
    return this.videoIdsHistory
  }

  getRecommendations (currentVideo: VideoDetails, exceptions = new Set<number>()): Observable<Video[]> {
    this.videoIdsHistory.add(currentVideo.id)

    // We want 5 results max
    // +1 to exclude the currentVideo if needed
    // +exceptions.size to exclude the videos we don't want to include
    // Cap to 30 results maximum
    const totalVideos = 5
    const internalTotalVideos = Math.min(totalVideos + 1 + exceptions.size, 30)

    return this.fetchPage(currentVideo, internalTotalVideos)
      .pipe(
        map(videos => {
          let otherVideos = videos.filter(v => v.uuid !== currentVideo.uuid && !exceptions.has(v.id))

          // Stop using exclude list if we excluded all videos
          if (otherVideos.length === 0 && videos.length !== 0) {
            otherVideos = videos.filter(v => v.uuid !== currentVideo.uuid)
          }

          return otherVideos.slice(0, totalVideos)
        })
      )
  }

  private fetchPage (currentVideo: VideoDetails, totalItems: number): Observable<Video[]> {
    const pagination = { currentPage: 1, itemsPerPage: totalItems }

    return this.userService.getAnonymousOrLoggedUser()
      .pipe(
        switchMap(user => {
          const nsfw = user.nsfwPolicy
            ? this.videos.nsfwPolicyToParam(user.nsfwPolicy)
            : undefined

          const defaultSubscription = this.videos.getVideos({
            skipCount: true,
            videoPagination: pagination,
            sort: '-publishedAt',
            nsfw
          }).pipe(map(v => v.data))

          const searchIndexConfig = this.config.search.searchIndex
          if (searchIndexConfig.enabled === true && searchIndexConfig.disableLocalSearch === true) {
            return defaultSubscription
          }

          return this.searchService.searchVideos({
            search: '',
            componentPagination: pagination,
            skipCount: true,
            advancedSearch: new AdvancedSearch({
              tagsOneOf: currentVideo.tags.join(','),
              sort: '-publishedAt',
              searchTarget: 'local',
              nsfw,
              excludeAlreadyWatched: user.id
                ? true
                : undefined
            })
          })
          .pipe(
            map(v => v.data),
            switchMap(videos => {
              if (videos.length <= 1) return defaultSubscription

              return of(videos)
            })
          )
        })
      )
  }
}
