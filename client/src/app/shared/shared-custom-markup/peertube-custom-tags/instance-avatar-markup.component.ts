import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core'
import { CustomMarkupComponent } from './shared'
import { ActorAvatarInput } from '@app/shared/shared-actor-image/actor-avatar.component'
import { ServerService } from '@app/core'
import { ActorAvatarComponent } from '../../shared-actor-image/actor-avatar.component'
import { NgIf } from '@angular/common'

/*
 * Markup component that creates the img HTML element containing the instance avatar
*/

@Component({
  selector: 'my-instance-avatar-markup',
  templateUrl: 'instance-avatar-markup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ NgIf, ActorAvatarComponent ]
})
export class InstanceAvatarMarkupComponent implements OnInit, CustomMarkupComponent {
  @Input() size: number

  actor: ActorAvatarInput
  loaded: undefined

  constructor (
    private cd: ChangeDetectorRef,
    private server: ServerService
  ) {}

  ngOnInit () {
    const { instance } = this.server.getHTMLConfig()

    this.actor = {
      avatars: instance.avatars,
      name: this.server.getHTMLConfig().instance.name
    }

    this.cd.markForCheck()
  }
}
