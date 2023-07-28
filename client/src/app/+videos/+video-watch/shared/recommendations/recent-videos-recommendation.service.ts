import { Observable, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ServerService, UserService } from '@app/core'
import { Video, VideoService } from '@app/shared/shared-main'
import { AdvancedSearch, SearchService } from '@app/shared/shared-search'
import { HTMLServerConfig } from '@shared/models'
import { RecommendationInfo } from './recommendation-info.model'
import { RecommendationService } from './recommendations.service'

/**
 * Provides "recommendations" by providing the most recently uploaded videos.
 */
@Injectable()
export class RecentVideosRecommendationService implements RecommendationService {
  readonly pageSize = 5

  private config: HTMLServerConfig

  constructor (
    private videos: VideoService,
    private searchService: SearchService,
    private userService: UserService,
    private serverService: ServerService
  ) {
    this.config = this.serverService.getHTMLConfig()
  }

  getRecommendations (recommendation: RecommendationInfo): Observable<Video[]> {

    return this.fetchPage(1, recommendation)
      .pipe(
        map(videos => {
          const otherVideos = videos.filter(v => v.uuid !== recommendation.uuid)
          return otherVideos.slice(0, this.pageSize)
        })
      )
  }

  private fetchPage (page: number, recommendation: RecommendationInfo): Observable<Video[]> {
    const pagination = { currentPage: page, itemsPerPage: this.pageSize + 1 }

    return this.userService.getAnonymousOrLoggedUser()
      .pipe(
        switchMap(user => {
          const nsfw = user.nsfwPolicy
            ? this.videos.nsfwPolicyToParam(user.nsfwPolicy)
            : undefined

          const defaultSubscription = this.videos.getVideos({
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
            advancedSearch: new AdvancedSearch({
              tagsOneOf: recommendation.tags.join(','),
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
