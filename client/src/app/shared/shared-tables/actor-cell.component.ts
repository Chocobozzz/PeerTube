import { booleanAttribute, Component, inject, input, OnInit } from '@angular/core'
import { RouterModule } from '@angular/router'
import { AuthService } from '@app/core'
import { ActorAvatarComponent, ActorAvatarInput } from '../shared-actor-image/actor-avatar.component'
import { CollaboratorStateComponent } from '../shared-main/channel/collaborator-state.component'

@Component({
  selector: 'my-actor-cell',
  templateUrl: './actor-cell.component.html',
  styleUrls: [ './actor-cell.component.scss' ],
  imports: [
    RouterModule,
    CollaboratorStateComponent,
    ActorAvatarComponent
  ]
})
export class ActorCellComponent implements OnInit {
  private authService = inject(AuthService)

  actor = input.required<ActorAvatarInput & { id: number, displayName: string }>()
  actorType = input.required<'channel' | 'account'>()
  displayAvatar = input(true, { transform: booleanAttribute })
  displayUsername = input(true, { transform: booleanAttribute })

  routerLink: string[]
  linkTitle: string

  ngOnInit (): void {
    if (this.actorType() === 'channel') {
      this.routerLink = [ '/c', this.actor().name ]
      this.linkTitle = $localize`Go to the channel page of ${this.actor().displayName}`
    } else {
      this.routerLink = [ '/a', this.actor().name ]
      this.linkTitle = $localize`Go to the account page of ${this.actor().displayName}`
    }
  }

  isEditorOfChannel (): boolean {
    if (this.actorType() !== 'channel') return false

    const user = this.authService.getUser()
    return user.isCollaboratingToChannels() && user.isEditorOfChannel(this.actor())
  }

  isOwnerOfChannel (): boolean {
    if (this.actorType() !== 'channel') return false

    const user = this.authService.getUser()
    return user.isCollaboratingToChannels() && user.isOwnerOfChannel(this.actor())
  }
}
