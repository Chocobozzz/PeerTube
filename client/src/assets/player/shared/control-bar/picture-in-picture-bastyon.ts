/**
 * @file picture-in-picture-toggle.js
 */
 /*import Button from '../button.js';
 import Component from '../component.js';
 import document from 'global/document';*/

 import videojs from "video.js";

 const Button = videojs.getComponent("Button");
 const MenuButton = videojs.getComponent("MenuButton");
  
  /**
   * Toggle Picture-in-Picture mode
   *
   * @extends Button
   */
  class PictureInPictureBastyon extends MenuButton {
  
 
    constructor(player, options) {
      super(player, options);
 
      this.controlText('Mini Player')
    }
 
    createEl(){
     return this.buildElement();
    }
 
    handleClick(event) {
     this.player_.trigger('pictureInPictureRequest', event)
    }
 
    private buildElement() {
 
     const el = super.createEl();
     
     el.classList.add("vjs-picture-in-picture-control");
 
     return el as HTMLButtonElement;
   }
  
  }
 
  videojs.registerComponent("PictureInPictureBastyon", PictureInPictureBastyon);
  