import { Component, OnInit, ViewChild, AfterViewChecked } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { InstanceService } from '@app/shared/instance/instance.service'
import { ServerConfig } from '@shared/models'
import { ActivatedRoute } from '@angular/router'
import { ResolverData } from './about-instance.resolver'
import { ViewportScroller } from '@angular/common'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ]
})
export class AboutInstanceComponent implements OnInit, AfterViewChecked {
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
    private viewportScroller: ViewportScroller,
    private route: ActivatedRoute,
    private serverService: ServerService,
    private instanceService: InstanceService
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

  async ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    const { about, languages, categories }: ResolverData = this.route.snapshot.data.instanceData

    this.languages = languages
    this.categories = categories

    this.shortDescription = about.instance.shortDescription

    this.creationReason = about.instance.creationReason
    this.maintenanceLifetime = about.instance.maintenanceLifetime
    this.businessModel = about.instance.businessModel

    this.html = await this.instanceService.buildHtml(about)
  }

  ngAfterViewChecked () {
    if (window.location.hash) this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))
  }

  openContactModal () {
    return this.contactAdminModal.show()
  }
}
