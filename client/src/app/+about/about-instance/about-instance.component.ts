import { Component, OnInit, ViewChild } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { InstanceService } from '@app/shared/instance/instance.service'
import { MarkdownService } from '@app/shared/renderer'
import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { ServerConfig } from '@shared/models'

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

  serverConfig: ServerConfig

  constructor (
    private notifier: Notifier,
    private serverService: ServerService,
    private instanceService: InstanceService,
    private markdownService: MarkdownService,
    private i18n: I18n
  ) {}

  get instanceName () {
    return this.serverConfig.instance.name
  }

  get isContactFormEnabled () {
    return this.serverConfig.email.enabled && this.serverConfig.contactForm.enabled
  }

  get isNSFW () {
    return this.serverConfig.instance.isNSFW
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.instanceService.getAbout()
        .pipe(
          switchMap(about => {
            return forkJoin([
              this.instanceService.buildTranslatedLanguages(about),
              this.instanceService.buildTranslatedCategories(about)
            ]).pipe(map(([ languages, categories ]) => ({ about, languages, categories })))
          })
        ).subscribe(
      async ({ about, languages, categories }) => {
        this.languages = languages
        this.categories = categories

        this.shortDescription = about.instance.shortDescription

        this.creationReason = about.instance.creationReason
        this.maintenanceLifetime = about.instance.maintenanceLifetime
        this.businessModel = about.instance.businessModel

        this.html = await this.instanceService.buildHtml(about)
      },

      () => this.notifier.error(this.i18n('Cannot get about information from server'))
    )
  }

  openContactModal () {
    return this.contactAdminModal.show()
  }
}
