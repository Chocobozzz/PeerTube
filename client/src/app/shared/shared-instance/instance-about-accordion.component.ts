import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { NgbAccordion } from '@ng-bootstrap/ng-bootstrap'
import { InstanceService } from './instance.service'
import { Notifier } from '@app/core'
import { About } from '@shared/models/server'

@Component({
  selector: 'my-instance-about-accordion',
  templateUrl: './instance-about-accordion.component.html',
  styleUrls: ['./instance-about-accordion.component.scss']
})
export class InstanceAboutAccordionComponent implements OnInit {
  @ViewChild('accordion', { static: true }) accordion: NgbAccordion
  @Output() init: EventEmitter<InstanceAboutAccordionComponent> = new EventEmitter<InstanceAboutAccordionComponent>()

  @Input() panels = {
    features: true,
    administrators: true,
    moderation: true,
    codeOfConduct: true,
    terms: true
  }

  about: About
  aboutHtml = {
    description: '',
    terms: '',
    codeOfConduct: '',
    moderationInformation: '',
    administrator: ''
  }

  constructor (
    private instanceService: InstanceService,
    private notifier: Notifier
  ) { }

  ngOnInit (): void {
    this.instanceService.getAbout()
      .subscribe(
        async about => {
          this.about = about

          this.aboutHtml = await this.instanceService.buildHtml(about)

          this.init.emit(this)
        },

        err => this.notifier.error(err.message)
      )
  }

  getAdministratorsPanel () {
    if (!this.about) return false
    if (!this.panels.administrators) return false

    return !!(this.aboutHtml?.administrator || this.about?.instance.maintenanceLifetime || this.about?.instance.businessModel)
  }

  get moderationPanel () {
    return this.panels.moderation && !!this.aboutHtml.moderationInformation
  }

  get codeOfConductPanel () {
    return this.panels.codeOfConduct && !!this.aboutHtml.codeOfConduct
  }

  get termsPanel () {
    return this.panels.terms && !!this.aboutHtml.terms
  }
}
