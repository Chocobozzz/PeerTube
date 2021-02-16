import { ErrorHandler } from '@angular/core'

export class CustomErrorHandler implements ErrorHandler {
  isModalOpen = false

  handleError (error: any) {
    if (!this.isModalOpen) {
      this.showModal()
    }

    console.error(error)
  }

  private createElement ({
        className = '',
        type = 'div'
    }) {
    const elem = document.createElement(type)
    elem.className = className

    return elem
  }

  private showModal () {
    const modal = this.createElement({ className: 'd-block modal show fade' })
    const modalDialog = this.createElement({ className: 'modal-dialog modal-dialog-centered' })
    modal.appendChild(modalDialog)
    const modalContent = this.createElement({ className: 'modal-content' })
    modalDialog.appendChild(modalContent)
    const modalHeader = this.createElement({ className: 'modal-header' })
    modalContent.appendChild(modalHeader)
    const modalTitle = this.createElement({ className: 'modal-title', type: 'h4' })
    modalTitle.innerText = 'Something went wrong'
    modalHeader.appendChild(modalTitle)
    const modalBody = this.createElement({ className: 'modal-body' })
    modalContent.appendChild(modalBody)
    const modalBodyInner = this.createElement({})
    modalBodyInner.innerText = 'We are sorry but it seems that an unexpected error happened. Please contact the site administrator if the error remains.'
    modalBody.appendChild(modalBodyInner)
    const modalFooter = this.createElement({ className: 'modal-footer inputs' })
    modalContent.appendChild(modalFooter)
    const okButton = this.createElement({ className: 'action-button-submit', type: 'input' })
    okButton.setAttribute('value', 'Close')
    okButton.setAttribute('type', 'button')
    okButton.addEventListener('click', () => {
      this.isModalOpen = false
      document.body.removeChild(modal)
      document.body.className = document.body.className.replace(' modal-open', '')
    })
    modalFooter.appendChild(okButton)

    document.body.appendChild(modal)
    document.body.className += ' modal-open'
    this.isModalOpen = true
  }
}
