import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { CustomMarkupComponent } from './shared'
import { InstanceService } from '@app/shared/shared-instance'
import { finalize } from 'rxjs'

/*
 * Markup component that creates the img HTML element containing the instance banner
*/

@Component({
  selector: 'my-instance-banner-markup',
  templateUrl: 'instance-banner-markup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstanceBannerMarkupComponent implements OnInit, CustomMarkupComponent {
  @Input() revertHomePaddingTop: boolean

  @Output() loaded = new EventEmitter<boolean>()

  instanceBannerUrl: string

  constructor (
    private cd: ChangeDetectorRef,
    private instance: InstanceService
  ) {}

  ngOnInit () {
    this.instance.getInstanceBannerUrl()
      .pipe(finalize(() => this.loaded.emit(true)))
      .subscribe(instanceBannerUrl => {
        this.instanceBannerUrl = instanceBannerUrl
        this.cd.markForCheck()
      })
  }
}
