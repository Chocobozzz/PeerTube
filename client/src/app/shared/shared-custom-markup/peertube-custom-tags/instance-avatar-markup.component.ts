import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, input } from '@angular/core'
import { CustomMarkupComponent } from './shared'
import { ActorAvatarInput } from '@app/shared/shared-actor-image/actor-avatar.component'
import { ServerService } from '@app/core'
import { ActorAvatarComponent } from '../../shared-actor-image/actor-avatar.component'

/*
 * Markup component that creates the img HTML element containing the instance avatar
 */

@Component({
  selector: 'my-instance-avatar-markup',
  templateUrl: 'instance-avatar-markup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ ActorAvatarComponent ]
})
export class InstanceAvatarMarkupComponent implements OnInit, CustomMarkupComponent {
  private cd = inject(ChangeDetectorRef)
  private server = inject(ServerService)

  readonly size = input<number>(undefined)

  actor: ActorAvatarInput
  loaded: undefined

  ngOnInit () {
    const { instance } = this.server.getHTMLConfig()

    this.actor = {
      avatars: instance.avatars,
      name: this.server.getHTMLConfig().instance.name
    }

    this.cd.markForCheck()
  }
}
