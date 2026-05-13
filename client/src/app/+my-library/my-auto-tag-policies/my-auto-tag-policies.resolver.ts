import { inject } from '@angular/core'
import { ResolveFn } from '@angular/router'
import { AuthService } from '@app/core'
import { AutomaticTagAvailableType } from '@peertube/peertube-models'
import { forkJoin, map } from 'rxjs'
import { AutomaticTagService } from './automatic-tag.service'

export type AutoTagPoliciesTag = {
  name: string
  review: boolean
  type: AutomaticTagAvailableType
}

export const autoTagPoliciesResolver: ResolveFn<AutoTagPoliciesTag[]> = () => {
  const authService = inject(AuthService)
  const autoTagService = inject(AutomaticTagService)

  const accountName = authService.getUser().account.name

  return forkJoin([
    autoTagService.listAvailable({ accountName }),
    autoTagService.getCommentPolicies({ accountName })
  ]).pipe(
    map(([ resAvailable, policies ]) => {
      return resAvailable.available
        .map(a => ({ name: a.name, type: a.type, review: policies.review.includes(a.name) }))
    })
  )
}
