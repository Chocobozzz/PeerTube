// Thanks: https://github.com/evseevdev/ngx-textarea-autosize
import { AfterViewInit, Directive, ElementRef, HostBinding, HostListener, inject } from '@angular/core'

@Directive({
  selector: 'textarea[myAutoResize]',
  standalone: true
})
export class TextareaAutoResizeDirective implements AfterViewInit {
  private elem = inject(ElementRef)

  @HostBinding('attr.rows')
  rows = '1'
  @HostBinding('style.overflow')
  overflow = 'hidden'

  public ngAfterViewInit () {
    this.resize()
  }

  @HostListener('input')
  resize () {
    const textarea = this.elem.nativeElement as HTMLTextAreaElement
    // Reset textarea height to auto that correctly calculate the new height
    textarea.style.height = 'auto'
    // Set new height
    textarea.style.height = `${textarea.scrollHeight}px`
  }
}
