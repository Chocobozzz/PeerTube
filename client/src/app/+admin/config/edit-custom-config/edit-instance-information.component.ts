import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'
import { ConfigService } from '../shared/config.service'
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
    private configService: ConfigService,
    private notifier: Notifier,
    private instance: InstanceService
  ) {

  }

  ngOnInit () {
    this.resetBannerUrl()
  }

  getCustomMarkdownRenderer () {
    return this.customMarkup.getCustomMarkdownRenderer()
  }

  onBannerChange (formData: FormData) {
    this.configService.updateInstanceBanner(formData)
        .subscribe({
          next: data => {
            this.notifier.success($localize`Banner changed.`)

            this.resetBannerUrl()
          },

          error: (err: HttpErrorResponse) => genericUploadErrorHandler({ err, name: $localize`banner`, notifier: this.notifier })
        })
  }

  onBannerDelete () {
    this.configService.deleteInstanceBanner()
      .subscribe({
        next: () => {
          this.notifier.success($localize`Banner deleted.`)

          this.resetBannerUrl()
        },

        error: err => this.notifier.error(err.message)
      })
  }

  private resetBannerUrl () {
    this.instance.getAbout()
      .subscribe(about => {
        const banners = about.instance.banners
        if (banners.length === 0) {
          this.instanceBannerUrl = undefined
          return
        }

        this.instanceBannerUrl = banners[0].path
      })
  }
}
