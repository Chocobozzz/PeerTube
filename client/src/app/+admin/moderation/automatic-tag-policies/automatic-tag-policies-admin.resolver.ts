import { inject } from '@angular/core'
import { ResolveFn } from '@angular/router'
import { AutomaticTagService } from '@app/shared/shared-moderation/automatic-tag.service'
import { AutomaticTagAvailableType } from '@peertube/peertube-models'
import { forkJoin, map } from 'rxjs'

export type AutomaticTagPoliciesAdminTag = {
  name: string
  autoBlock: boolean
  type: AutomaticTagAvailableType
}

export const automaticTagPoliciesAdminResolver: ResolveFn<AutomaticTagPoliciesAdminTag[]> = () => {
  const autoTagService = inject(AutomaticTagService)

  return forkJoin([
    autoTagService.getServerAutomaticTagAvailable(),
    autoTagService.getServerVideoPolicies()
  ]).pipe(
    map(([ resAvailable, policies ]) => {
      return resAvailable.available
        .map(a => ({ name: a.name, type: a.type, autoBlock: policies.autoBlock.includes(a.name) }))
    })
  )
}
