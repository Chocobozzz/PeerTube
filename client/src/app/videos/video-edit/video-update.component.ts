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

  tagValidators = VIDEO_TAGS.VALIDATORS;
  tagValidatorsMessages = VIDEO_TAGS.MESSAGES;

  error: string = null;
  form: FormGroup;
  formErrors = {
    name: '',
    category: '',
    licence: '',
    language: '',
    description: ''
  };
  validationMessages = {
    name: VIDEO_NAME.MESSAGES,
    category: VIDEO_CATEGORY.MESSAGES,
    licence: VIDEO_LICENCE.MESSAGES,
    language: VIDEO_LANGUAGE.MESSAGES,
    description: VIDEO_DESCRIPTION.MESSAGES
  };

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
      tags: [ '' ]
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

  update() {
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

  private hydrateFormFromVideo() {
    this.form.patchValue(this.video.toJSON());
  }
}
