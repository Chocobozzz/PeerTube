import { Component, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AuthService, Notifier } from '@app/core'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { AutomaticTagAvailableType } from '@peertube/peertube-models'
import { forkJoin } from 'rxjs'
import { AutomaticTagService } from './automatic-tag.service'

@Component({
  templateUrl: './my-auto-tag-policies.component.html',
  imports: [
    GlobalIconComponent,
    FormsModule,
    PeertubeCheckboxComponent
  ]
})
export class MyAutoTagPoliciesComponent implements OnInit {
  tags: { name: string, review: boolean, type: AutomaticTagAvailableType }[] = []

  constructor (
    private authService: AuthService,
    private autoTagsService: AutomaticTagService,
    private notifier: Notifier
  ) {

  }

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

      error: err => this.notifier.error(err.message)
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
