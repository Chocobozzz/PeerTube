import videojs from 'video.js'

const Component = videojs.getComponent('Component')

class SettingsDialog extends Component {
  constructor (player: videojs.Player) {
    super(player)

    this.hide()
  }

  /**
   * Create the component's DOM element
   *
   */
  createEl () {
    const uniqueId = this.id()
    const dialogLabelId = 'TTsettingsDialogLabel-' + uniqueId
    const dialogDescriptionId = 'TTsettingsDialogDescription-' + uniqueId

    return super.createEl('div', {
      className: 'vjs-settings-dialog vjs-modal-overlay',
      tabIndex: -1
    }, {
      'role': 'dialog',
      'aria-labelledby': dialogLabelId,
      'aria-describedby': dialogDescriptionId
    })
  }

  show () {
    this.player().addClass('vjs-settings-dialog-opened')

    super.show()
  }

  hide () {
    this.player().removeClass('vjs-settings-dialog-opened')

    super.hide()
  }
}

Component.registerComponent('SettingsDialog', SettingsDialog)

export { SettingsDialog }
