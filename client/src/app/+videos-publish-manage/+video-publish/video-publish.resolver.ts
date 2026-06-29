import { Injectable, inject } from '@angular/core'
import { AuthService, ServerService, UserService } from '@app/core'
import { listChannelsForSelect } from '@app/shared/shared-forms/select/channel/select-channel-helpers'
import { ConstantLabel, UserVideoQuota, VideoPrivacyType } from '@peertube/peertube-models'
import { forkJoin } from 'rxjs'
import { map } from 'rxjs/operators'
import { SelectChannelItem } from '../../../types'

export type VideoPublishResolverData = {
  videoChannels: SelectChannelItem[]
  userQuota: UserVideoQuota
  privacies: ConstantLabel<VideoPrivacyType>[]
}

@Injectable()
export class VideoPublishResolver {
  private authService = inject(AuthService)
  private serverService = inject(ServerService)
  private userService = inject(UserService)

  resolve () {
    return forkJoin([
      listChannelsForSelect({
        authService: this.authService,
        includeCollaborations: true
      }),
      this.userService.getMyVideoQuotaUsed(),
      this.serverService.getVideoPrivacies()
    ]).pipe(map(([ videoChannels, userQuota, privacies ]) => ({ videoChannels, userQuota, privacies } satisfies VideoPublishResolverData)))
  }
}
