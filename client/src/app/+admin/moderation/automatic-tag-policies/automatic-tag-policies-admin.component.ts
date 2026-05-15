import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { HtmlRendererService, Notifier } from '@app/core'
import { PeertubeCheckboxComponent } from '@app/shared/shared-forms/peertube-checkbox.component'
import { AutomaticTagService } from '@app/shared/shared-moderation/automatic-tag.service'
import { AutomaticTagAvailableType } from '@peertube/peertube-models'
import { AutomaticTagPoliciesAdminTag } from './automatic-tag-policies-admin.resolver'

@Component({
  templateUrl: './automatic-tag-policies-admin.component.html',
  imports: [
    FormsModule,
    PeertubeCheckboxComponent
  ]
})
export class AutomaticTagPoliciesAdminComponent implements OnInit {
  private autoTagsService = inject(AutomaticTagService)
  private notifier = inject(Notifier)
  private html = inject(HtmlRendererService)
  private route = inject(ActivatedRoute)

  tags: AutomaticTagPoliciesAdminTag[] = []

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
    this.autoTagsService.updateServerVideoPolicies({
      autoBlock: this.tags.filter(t => t.autoBlock).map(t => t.name)
    }).subscribe({
      next: () => {
        this.notifier.success($localize`Video auto-block policies updated`)
      },

      error: err => this.notifier.handleError(err)
    })
  }
}
