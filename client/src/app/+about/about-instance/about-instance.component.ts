import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { InstanceService } from '@app/shared/instance/instance.service'
import { MarkdownService } from '@app/shared/renderer'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ]
})
export class AboutInstanceComponent implements OnInit {
  @ViewChild('contactAdminModal', { static: true }) contactAdminModal: ContactAdminModalComponent

  shortDescription = ''

  html = {
    description: '',
    terms: '',
    codeOfConduct: '',
    moderationInformation: '',
    administrator: ''
  }

  maintenanceLifetime = ''
  businessModel = ''

  languages: string[] = []
  categories: number[] = []

  constructor (
    private notifier: Notifier,
    private serverService: ServerService,
    private instanceService: InstanceService,
    private markdownService: MarkdownService,
    private i18n: I18n
  ) {}

  get instanceName () {
    return this.serverService.getConfig().instance.name
  }

  get isContactFormEnabled () {
    return this.serverService.getConfig().email.enabled && this.serverService.getConfig().contactForm.enabled
  }

  get isNSFW () {
    return this.serverService.getConfig().instance.isNSFW
  }

  ngOnInit () {
    this.instanceService.getAbout()
      .subscribe(
        async res => {
          this.shortDescription = res.instance.shortDescription

          this.maintenanceLifetime = res.instance.maintenanceLifetime
          this.businessModel = res.instance.businessModel

          for (const key of [ 'description', 'terms', 'codeOfConduct', 'moderationInformation', 'administrator' ]) {
            this.html[key] = await this.markdownService.textMarkdownToHTML(res.instance[key])
          }

          this.languages = res.instance.languages
          this.categories = res.instance.categories
        },

        () => this.notifier.error(this.i18n('Cannot get about information from server'))
      )
  }

  openContactModal () {
    return this.contactAdminModal.show()
  }

}
