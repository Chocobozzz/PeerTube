import { CommonModule } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ServerService } from '@app/core'
import { AboutHTML } from '@app/shared/shared-main/instance/instance.service'
import { ResolverData } from '../about-instance.resolver'

@Component({
  templateUrl: './about-instance-team.component.html',
  styleUrls: [ './about-instance-common.component.scss' ],
  imports: [ CommonModule ]
})
export class AboutInstanceTeamComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private serverService = inject(ServerService)

  aboutHTML: AboutHTML

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  ngOnInit () {
    const { aboutHTML }: ResolverData = this.route.parent.snapshot.data.instanceData

    this.aboutHTML = aboutHTML
  }
}
