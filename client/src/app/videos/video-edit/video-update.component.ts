import { Component, ElementRef, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { FileUploader } from 'ng2-file-upload/ng2-file-upload';
import { NotificationsService } from 'angular2-notifications';

import { AuthService } from '../../core';
import {
  FormReactive,
  VIDEO_NAME,
  VIDEO_CATEGORY,
  VIDEO_LICENCE,
  VIDEO_LANGUAGE,
  VIDEO_DESCRIPTION,
  VIDEO_TAGS
} from '../../shared';
import { Video, VideoService } from '../shared';

@Component({
  selector: 'my-videos-update',
  styleUrls: [ './video-edit.component.scss' ],
  templateUrl: './video-update.component.html'
})

export class VideoUpdateComponent extends FormReactive implements OnInit {
  tags: string[] = [];
  videoCategories = [];
  videoLicences = [];
  videoLanguages = [];
  video: Video;

  error: string = null;
  form: FormGroup;
  formErrors = {
    name: '',
    category: '',
    licence: '',
    language: '',
    description: '',
    currentTag: ''
  };
  validationMessages = {
    name: VIDEO_NAME.MESSAGES,
    category: VIDEO_CATEGORY.MESSAGES,
    licence: VIDEO_LICENCE.MESSAGES,
    language: VIDEO_LANGUAGE.MESSAGES,
    description: VIDEO_DESCRIPTION.MESSAGES,
    currentTag: VIDEO_TAGS.MESSAGES
  };

  // Special error messages
  tagsError = '';
  fileError = '';

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef,
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private videoService: VideoService
  ) {
    super();
  }

  buildForm() {
    this.form = this.formBuilder.group({
      name: [ '', VIDEO_NAME.VALIDATORS ],
      nsfw: [ false ],
      category: [ '', VIDEO_CATEGORY.VALIDATORS ],
      licence: [ '', VIDEO_LICENCE.VALIDATORS ],
      language: [ '', VIDEO_LANGUAGE.VALIDATORS ],
      description: [ '', VIDEO_DESCRIPTION.VALIDATORS ],
      currentTag: [ '', VIDEO_TAGS.VALIDATORS ]
    });

    this.form.valueChanges.subscribe(data => this.onValueChanged(data));
  }

  ngOnInit() {
    this.buildForm();

    this.videoCategories = this.videoService.videoCategories;
    this.videoLicences = this.videoService.videoLicences;
    this.videoLanguages = this.videoService.videoLanguages;

    const id = this.route.snapshot.params['id'];
    this.videoService.getVideo(id)
                     .subscribe(
                       video => {
                         this.video = video;

                         this.hydrateFormFromVideo();
                       },

                       err => this.error = 'Cannot fetch video.'
                     );
  }

  checkForm() {
    this.forceCheck();

    return this.form.valid === true && this.tagsError === '' && this.fileError === '';
  }


  onTagKeyPress(event: KeyboardEvent) {
    // Enter press
    if (event.keyCode === 13) {
      this.addTagIfPossible();
    }
  }

  removeTag(tag: string) {
    this.tags.splice(this.tags.indexOf(tag), 1);
    this.form.get('currentTag').enable();
  }

  update() {
    // Maybe the user forgot to press "enter" when he filled the field
    this.addTagIfPossible();

    if (this.checkForm() === false) {
      return;
    }

    this.video.patch(this.form.value);

    this.videoService.updateVideo(this.video)
                     .subscribe(
                       () => {
                         this.notificationsService.success('Success', 'Video updated.');
                         this.router.navigate([ '/videos/watch', this.video.id ]);
                       },

                       err => {
                         this.error = 'Cannot update the video.';
                         console.error(err);
                       }
                      );

  }

  private addTagIfPossible() {
    const currentTag = this.form.value['currentTag'];
    if (currentTag === undefined) return;

    // Check if the tag is valid and does not already exist
    if (
      currentTag.length >= 2 &&
      this.form.controls['currentTag'].valid &&
      this.tags.indexOf(currentTag) === -1
    ) {
      this.tags.push(currentTag);
      this.form.patchValue({ currentTag: '' });

      if (this.tags.length >= 3) {
        this.form.get('currentTag').disable();
      }

      this.tagsError = '';
    }
  }

  private hydrateFormFromVideo() {
    this.form.patchValue(this.video.toJSON());
  }
}
