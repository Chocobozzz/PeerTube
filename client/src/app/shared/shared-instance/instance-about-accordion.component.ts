import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { NgbAccordion } from '@ng-bootstrap/ng-bootstrap'
import { InstanceService } from './instance.service'
import { Notifier } from '@app/core'
import { About } from '@shared/models/server'

@Component({
  selector: 'my-instance-about-accordion',
  templateUrl: './instance-about-accordion.component.html',
  styleUrls: ['./instance-about-accordion.component.scss']
})
export class InstanceAboutAccordion implements OnInit {
  @ViewChild('accordion', { static: true }) accordion: NgbAccordion
  @Output() init: EventEmitter<InstanceAboutAccordion> = new EventEmitter<InstanceAboutAccordion>()

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
}
