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
  @ViewChild('contactAdminModal') contactAdminModal: ContactAdminModalComponent

  shortDescription = ''
  descriptionHTML = ''
  termsHTML = ''

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

  get userVideoQuota () {
    return this.serverService.getConfig().user.videoQuota
  }

  get isSignupAllowed () {
    return this.serverService.getConfig().signup.allowed
  }

  get isContactFormEnabled () {
    return this.serverService.getConfig().email.enabled && this.serverService.getConfig().contactForm.enabled
  }

  ngOnInit () {
    this.instanceService.getAbout()
      .subscribe(
        res => {
          this.shortDescription = res.instance.shortDescription
          this.descriptionHTML = this.markdownService.textMarkdownToHTML(res.instance.description)
          this.termsHTML = this.markdownService.textMarkdownToHTML(res.instance.terms)
        },

        () => this.notifier.error(this.i18n('Cannot get about information from server'))
      )
  }

  openContactModal () {
    return this.contactAdminModal.show()
  }

}
