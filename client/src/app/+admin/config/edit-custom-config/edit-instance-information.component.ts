import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'
import { Notifier } from '@app/core'
import { HttpErrorResponse } from '@angular/common/http'
import { genericUploadErrorHandler } from '@app/helpers'
import { InstanceService } from '@app/shared/shared-instance'

@Component({
  selector: 'my-edit-instance-information',
  templateUrl: './edit-instance-information.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditInstanceInformationComponent implements OnInit {
  @Input() form: FormGroup
  @Input() formErrors: any

  @Input() languageItems: SelectOptionsItem[] = []
  @Input() categoryItems: SelectOptionsItem[] = []

  instanceBannerUrl: string

  constructor (
    private customMarkup: CustomMarkupService,
    private notifier: Notifier,
    private instanceService: InstanceService
  ) {

  }

  ngOnInit () {
    this.resetBannerUrl()
  }

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }

  onBannerChange (formData: FormData) {
    this.instanceService.updateInstanceBanner(formData)
        .subscribe({
          next: () => {
            this.notifier.success($localize`Banner changed.`)

            this.resetBannerUrl()
          },

          error: (err: HttpErrorResponse) => genericUploadErrorHandler({ err, name: $localize`banner`, notifier: this.notifier })
        })
  }

  onBannerDelete () {
    this.instanceService.deleteInstanceBanner()
      .subscribe({
        next: () => {
          this.notifier.success($localize`Banner deleted.`)

          this.resetBannerUrl()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private resetBannerUrl () {
    this.instanceService.getInstanceBannerUrl()
      .subscribe(instanceBannerUrl => {
        this.instanceBannerUrl = instanceBannerUrl
      })
  }
}
