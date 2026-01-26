import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, Notifier } from '@app/core'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'

import { AutomaticTagAvailableType } from '@peertube/peertube-models'
import { forkJoin } from 'rxjs'
import { AutomaticTagService } from './automatic-tag.service'

@Component({
  templateUrl: './my-auto-tag-policies.component.html',
  imports: [
    FormsModule,
    PeertubeCheckboxComponent
  ]
})
export class MyAutoTagPoliciesComponent implements OnInit {
  private authService = inject(AuthService)
  private autoTagsService = inject(AutomaticTagService)
  private notifier = inject(Notifier)

  tags: { name: string, review: boolean, type: AutomaticTagAvailableType }[] = []

  ngOnInit () {
    this.loadAvailableTags()
  }

  getLabelText (tag: { name: string, type: AutomaticTagAvailableType }) {
    if (tag.name === 'external-link') {
      return $localize`That contain an external link`
    }

    return $localize`That contain any word from your "${tag.name}" watched word list`
  }

  updatePolicies () {
    const accountName = this.authService.getUser().account.name

    this.autoTagsService.updateCommentPolicies({
      accountName,
      review: this.tags.filter(t => t.review).map(t => t.name)
    }).subscribe({
      next: () => {
        this.notifier.success($localize`Comment policies updated`)
      },

      error: err => this.notifier.handleError(err)
    })
  }

  private loadAvailableTags () {
    const accountName = this.authService.getUser().account.name

    forkJoin([
      this.autoTagsService.listAvailable({ accountName }),
      this.autoTagsService.getCommentPolicies({ accountName })
    ]).subscribe(([ resAvailable, policies ]) => {
      this.tags = resAvailable.available
        .map(a => ({ name: a.name, type: a.type, review: policies.review.includes(a.name) }))
    })
  }
}
