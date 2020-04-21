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
   * @return {Element}
   * @method createEl
   */
  createEl () {
    const uniqueId = this.id()
    const dialogLabelId = 'TTsettingsDialogLabel-' + uniqueId
    const dialogDescriptionId = 'TTsettingsDialogDescription-' + uniqueId

    return super.createEl('div', {
      className: 'vjs-settings-dialog vjs-modal-overlay',
      innerHTML: '',
      tabIndex: -1
    }, {
      'role': 'dialog',
      'aria-labelledby': dialogLabelId,
      'aria-describedby': dialogDescriptionId
    })
  }
}

Component.registerComponent('SettingsDialog', SettingsDialog)

export { SettingsDialog }
