import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { InstanceService } from '@app/shared/instance/instance.service'
import { MarkdownService } from '@app/shared/renderer'
import { forkJoin } from 'rxjs'
import { first } from 'rxjs/operators'

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
    administrator: '',
    hardwareInformation: ''
  }

  creationReason = ''
  maintenanceLifetime = ''
  businessModel = ''

  languages: string[] = []
  categories: string[] = []

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
    forkJoin([
      this.instanceService.getAbout(),
      this.serverService.localeObservable.pipe(first()),
      this.serverService.videoLanguagesLoaded.pipe(first()),
      this.serverService.videoCategoriesLoaded.pipe(first())
    ]).subscribe(
      async ([ about, translations ]) => {
        this.shortDescription = about.instance.shortDescription

        this.creationReason = about.instance.creationReason
        this.maintenanceLifetime = about.instance.maintenanceLifetime
        this.businessModel = about.instance.businessModel

        this.html = await this.instanceService.buildHtml(about)

        this.languages = this.instanceService.buildTranslatedLanguages(about, translations)
        this.categories = this.instanceService.buildTranslatedCategories(about, translations)
      },

      () => this.notifier.error(this.i18n('Cannot get about information from server'))
    )
  }

  openContactModal () {
    return this.contactAdminModal.show()
  }
}
