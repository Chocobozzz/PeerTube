;(function () {
  'use strict'

  var $ = require('jquery')
  require('blueimp-file-upload')

  var WebTorrent = require('webtorrent')
  var client = new WebTorrent({ dht: false })

  var $content = $('#ajax_load')

  // Webtorrent events
  client.on('error', function (err) {
    console.error(err)
  })

  client.on('warning', function (err) {
    console.warning(err)
  })

  // Events of the panel
  $('#panel_get_videos').on('click', function () {
    getVideos()
  })

  $('#panel_upload_video').on('click', function () {
    uploadVideo()
  })

  $('#panel_make_friends').on('click', function () {
    makeFriends()
  })

  $('#search_video').on('keyup', function (e) {
    var search = $(this).val()

    if (search === '') return

    if (e.keyCode === 13) {
      $.ajax({
        url: '/api/v1/videos/search/' + search,
        type: 'GET',
        dataType: 'json',
        success: function (videos) {
          printVideos(videos)
        }
      })
    }
  })

  // Join a new network
  function makeFriends () {
    $.ajax({
      url: '/api/v1/pods/makefriends',
      type: 'GET',
      dataType: 'json',
      success: function () {
        alert('Made friends!')
      }
    })
  }

  function printVideos (videos) {
    $content.empty()

    if (videos.length === 0) {
      $content.text('There is no videos.')
    }

    videos.forEach(function (video) {
      var $video = $('<div></div>').addClass('video')

      var $video_name = $('<span></span>').addClass('video_name').text(video.name)
      var $video_pod = $('<span></span>').addClass('video_pod_url').text(video.podUrl)
      var $remove = $('<span></span>').addClass('span_action glyphicon glyphicon-remove')
      var $header = $('<div></div>').append([ $video_name, $video_pod, $remove ])

      var $video_description = $('<div></div>').addClass('video_description').text(video.description)

      // Get the video
      $video_name.on('click', function () {
        getVideo(video)
      })

      // Remove the video
      $remove.on('click', function () {
        // TODO
        if (!confirm('Are you sure ?')) return

        removeVideo(video)
      })

      if (!video.magnetUri) {
        $remove.css('display', 'none')
      }

      $video.append([ $header, $video_description ])
      $content.append($video)
    })
  }

  // Upload the video, the server will seed it
  function uploadVideo () {
    // Creating all the elements
    var $video_label = $('<label></label>').attr('for', 'name').text('Video name')
    var $video_name = $('<input></input>').addClass('form-control').attr({
      name: 'name',
      id: 'name'
    })
    var $video_block = $('<div></div>').addClass('form-group').append([ $video_label, $video_name ])

    var $title = $('<h3></h3>').text('Upload a video')

    var $button_text = $('<span></span>').text('Select the video...')
    var $input_video = $('<input></input>').attr({
      type: 'file',
      name: 'input_video',
      id: 'input_video'
    })
    var $button = $('<div></div>').addClass('btn btn-default btn-file').append([ $button_text, $input_video ])

    var $description_label = $('<label></label>').attr('for', 'description').text('Description')
    var $description_text = $('<textarea></textarea>').addClass('form-control').attr({
      name: 'description',
      id: 'description',
      placeholder: 'Description...'
    })
    var $description = $('<div></div>').addClass('form-group').append([ $description_label, $description_text ])

    var $bar = $('<progress></progress').attr('value', '0').css('display', 'none')
    var $progress_bar = $('<div><div>').attr('id', 'progress').append($bar)

    var $input_submit = $('<input></input>').addClass('btn btn-default').attr({
      type: 'button',
      value: 'Upload'
    })

    // JQuery plugin
    var $form_video = $('<form></form>').append([ $video_block, $button, $progress_bar, $description, $input_submit ])
    $form_video.fileupload({
      singleFileUploads: true,
      multipart: true,
      url: '/api/v1/videos',
      autoupload: false,
      add: function (e, data) {
        var $text = $('<span></span>').addClass('name_file').text(data['files'][0]['name'])
        $text.insertAfter($button)
        $input_submit.off('click').on('click', function () {
          $bar.css('display', 'block')
          data.formData = $form_video.serializeArray()
          data.submit()
        })
      },
      progressall: function (e, data) {
        $bar.attr({
          value: data.loaded,
          max: data.total
        })
      },
      done: function (e, data) {
        // Print all the videos once it's finished
        getVideos()
      }
    })

    $content.empty()
    $content.append([ $title, $form_video ])
  }

  // Print the list of all the videos
  function getVideos () {
    $.ajax({
      url: '/api/v1/videos/',
      dataType: 'json',
      type: 'GET',
      success: function (videos) {
        printVideos(videos)
      }
    })
  }

  function removeVideo (video) {
    $.ajax({
      url: '/api/v1/videos/' + video._id,
      type: 'DELETE',
      success: function (response, status) {
        getVideos()
      }
    })
  }

  // Get the video: add the torrent file and stream it into a video tag
  function getVideo (video) {
    var $waiting = $('<img></img>').addClass('center-block loading').attr('src', '/images/loading.gif')
    $content.empty()
    $content.append($waiting)

    console.log('Getting ' + video)
    client.add(video.magnetUri, function (torrent) {
      var $embed = $('<div></div>').addClass('embed-responsive embed-responsive-16by9')

      $content.empty()
      $content.append($embed)

      // Got torrent metadata!
      console.log('Torrent info hash:', torrent.infoHash)

      // Let's say the first file is a webm (vp8) or mp4 (h264) video...
      var file = torrent.files[0]

      file.appendTo($embed.get(0), function (err) {
        if (err) {
          alert('Cannot append the file.')
          console.err(err)
        }
      })
    })
  }

  getVideos()
})()
