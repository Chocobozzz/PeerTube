import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, input } from '@angular/core'

@Component({
  selector: 'my-custom-icon',
  template: '',
  styleUrls: [ './common-icon.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class CustomIconComponent implements OnInit {
  private el = inject(ElementRef)

  readonly unsafeHTML = input.required<string>()

  ngOnInit () {
    const nativeElement = this.el.nativeElement as HTMLElement

    nativeElement.innerHTML = this.unsafeHTML()
    nativeElement.ariaHidden = 'true'
  }
}
