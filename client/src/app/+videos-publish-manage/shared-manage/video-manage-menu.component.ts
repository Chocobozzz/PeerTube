import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, inject, input, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoEdit } from './common/video-edit.model'
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
    GlobalIconComponent
  ]
})
export class VideoManageMenuComponent implements OnInit {
  private manageController = inject(VideoManageController)

  readonly canWatch = input.required<boolean, string | boolean>({ transform: booleanAttribute })

  private videoEdit: VideoEdit

  ngOnInit (): void {
    const { videoEdit } = this.manageController.getStore()

    this.videoEdit = videoEdit
  }

  getVideo () {
    return this.videoEdit.getVideoAttributes()
  }
}
