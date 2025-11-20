import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, input, OnInit } from '@angular/core'
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap'

export type CollaboratorStateType = 'owner' | 'accepted' | 'invited'

@Component({
  selector: 'my-collaborator-state',
  templateUrl: './collaborator-state.component.html',
  styleUrls: [ './collaborator-state.component.scss' ],
  imports: [ CommonModule, NgbTooltipModule ]
})
export class CollaboratorStateComponent implements OnInit {
  readonly type = input.required<CollaboratorStateType>()
  readonly small = input(false, { transform: booleanAttribute })
  readonly disableTooltip = input(false, { transform: booleanAttribute })

  editorTooltip: string
  ownerTooltip: string
  invitationTooltip: string

  ngOnInit () {
    this.editorTooltip = this.disableTooltip()
      ? null
      : $localize`An editor can manage videos in this channel`

    this.ownerTooltip = this.disableTooltip()
      ? null
      : $localize`Owner of the channel`

    this.invitationTooltip = this.disableTooltip()
      ? null
      : $localize`Invited to be an editor to manage videos in this channel`
  }
}
