import { Directive, Output, EventEmitter, HostBinding, HostListener } from '@angular/core'

@Directive({
  selector: '[dragDrop]'
})
export class DragDropDirective {
  @Output() fileDropped = new EventEmitter<FileList>()

  @HostBinding('class.dragover') dragover = false

  @HostListener('dragover', ['$event']) onDragOver (e: Event) {
    e.preventDefault()
    e.stopPropagation()
    this.dragover = true
  }

  @HostListener('dragleave', ['$event']) public onDragLeave (e: Event) {
    e.preventDefault()
    e.stopPropagation()
    this.dragover = false
  }

  @HostListener('drop', ['$event']) public ondrop (e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    this.dragover = false
    const files = e.dataTransfer.files
    if (files.length > 0) this.fileDropped.emit(files)
  }
}
