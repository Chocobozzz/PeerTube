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
      : $localize`You are an editor of this channel`

    this.ownerTooltip = this.disableTooltip()
      ? null
      : $localize`You are the owner of this channel`

    this.invitationTooltip = this.disableTooltip()
      ? null
      : $localize`You have been invited to be an editor of this channel`
  }
}
