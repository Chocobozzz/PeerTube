import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, inject, input, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { ServerService } from '@app/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { getReplaceFileUnavailability, getStudioUnavailability } from './common/unavailable-features'
import { VideoEdit } from './common/video-edit.model'
import { UnavailableMenuEntryComponent } from './unavailable-menu-entry.component'
import { VideoManageController } from './video-manage-controller.service'

@Component({
  selector: 'my-video-manage-menu',
  styleUrls: [ './video-manage-menu.component.scss' ],
  templateUrl: './video-manage-menu.component.html',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NgbTooltipModule,
    GlobalIconComponent,
    UnavailableMenuEntryComponent
  ]
})
export class VideoManageMenuComponent implements OnInit {
  private serverService = inject(ServerService)
  private manageController = inject(VideoManageController)

  readonly canWatch = input.required<boolean, string | boolean>({ transform: booleanAttribute })

  private videoEdit: VideoEdit
  private replaceFileEnabled: boolean
  private studioEnabled: boolean
  private instanceName: string

  ngOnInit (): void {
    const config = this.serverService.getHTMLConfig()
    this.studioEnabled = config.videoStudio.enabled === true
    this.instanceName = config.instance.name
    this.replaceFileEnabled = config.videoFile.update.enabled === true

    const { videoEdit } = this.manageController.getStore()
    this.videoEdit = videoEdit
  }

  getVideo () {
    return this.videoEdit.getVideoAttributes()
  }

  studioUnavailable () {
    return getStudioUnavailability({
      ...this.videoEdit.getVideoAttributes(),

      instanceName: this.instanceName,
      studioEnabled: this.studioEnabled
    })
  }

  replaceFileUnavailable () {
    return getReplaceFileUnavailability({
      ...this.videoEdit.getVideoAttributes(),

      instanceName: this.instanceName,
      replaceFileEnabled: this.replaceFileEnabled
    })
  }
}
