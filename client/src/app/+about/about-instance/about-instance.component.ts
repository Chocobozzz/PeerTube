import { ViewportScroller } from '@angular/common'
import { AfterViewChecked, Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { Notifier } from '@app/core'
import { copyToClipboard } from '../../../root-helpers/utils'
import { InstanceService } from '@app/shared/shared-instance'
import { ServerConfig } from '@shared/models'
import { ResolverData } from './about-instance.resolver'

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
    creationReason: '',
    maintenanceLifetime: '',
    businessModel: '',
    hardwareInformation: ''
  }

  languages: string[] = []
  categories: string[] = []

  serverConfig: ServerConfig

  initialized = false

  private lastScrollHash: string

  constructor (
    private viewportScroller: ViewportScroller,
    private route: ActivatedRoute,
    private notifier: Notifier,
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
    const { about, languages, categories, serverConfig }: ResolverData = this.route.snapshot.data.instanceData

    this.serverConfig = serverConfig

    this.languages = languages
    this.categories = categories

    this.shortDescription = about.instance.shortDescription

    this.html = await this.instanceService.buildHtml(about)

    this.initialized = true
  }

  ngAfterViewChecked () {
    if (this.initialized && window.location.hash && window.location.hash !== this.lastScrollHash) {
      this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))

      this.lastScrollHash = window.location.hash
    }
  }

  openContactModal () {
    return this.contactAdminModal.show()
  }

  onClickCopyLink (anchor: HTMLAnchorElement) {
    const link = anchor.href
    copyToClipboard(link)
    this.notifier.success(link, $localize `Link copied`)
  }
}
