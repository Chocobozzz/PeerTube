import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { AuthService, HtmlRendererService, Notifier } from '@app/core'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { AutomaticTagService } from '@app/shared/shared-moderation/automatic-tag.service'
import { AutomaticTagAvailableType } from '@peertube/peertube-models'
import { AutoTagPoliciesTag } from './my-auto-tag-policies.resolver'

@Component({
  templateUrl: './my-auto-tag-policies.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    PeertubeCheckboxComponent
  ]
})
export class MyAutoTagPoliciesComponent implements OnInit {
  private authService = inject(AuthService)
  private autoTagsService = inject(AutomaticTagService)
  private notifier = inject(Notifier)
  private html = inject(HtmlRendererService)
  private route = inject(ActivatedRoute)

  tags: AutoTagPoliciesTag[] = []

  ngOnInit () {
    this.tags = this.route.snapshot.data['tags']
  }

  getLabelText (tag: { name: string, type: AutomaticTagAvailableType }) {
    const text = tag.name === 'external-link'
      ? $localize`That contain <strong>an external link</strong>`
      : $localize`That contain any word from your <strong>${tag.name}</strong> watched word list`

    return this.html.toSimpleSafeHtml(text)
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
}
