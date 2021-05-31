import { ViewportScroller } from '@angular/common'
import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ContactAdminModalComponent } from '@app/+about/about-instance/contact-admin-modal.component'
import { Notifier } from '@app/core'
import { CustomMarkupService } from '@app/shared/shared-custom-markup'
import { InstanceService } from '@app/shared/shared-instance'
import { About, ServerConfig } from '@shared/models'
import { copyToClipboard } from '../../../root-helpers/utils'
import { ResolverData } from './about-instance.resolver'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ]
})
export class AboutInstanceComponent implements OnInit, AfterViewChecked {
  @ViewChild('descriptionWrapper') descriptionWrapper: ElementRef<HTMLInputElement>
  @ViewChild('contactAdminModal', { static: true }) contactAdminModal: ContactAdminModalComponent

  shortDescription = ''
  descriptionContent: string

  html = {
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
    private customMarkupService: CustomMarkupService,
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
    this.descriptionContent = about.instance.description

    this.html = await this.instanceService.buildHtml(about)

    await this.injectDescription(about)

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

  private async injectDescription (about: About) {
    const element = await this.customMarkupService.buildElement(about.instance.description)

    this.descriptionWrapper.nativeElement.appendChild(element)
  }
}
