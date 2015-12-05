'use strict'

module.exports = function (grunt) {
  var paths = {
    dist: 'dist',
    jade: 'views/**/**/*.jade',
    css: 'public/stylesheets/*.css',
    scss: 'public/stylesheets/application.scss',
    vendor: 'public/stylesheets/vendor',
    js: 'public/javascripts/*.js',
    src: 'src/*.js',
    routes: 'routes/**/*.js',
    main: './server.js',
    browserified: 'public/javascripts/bundle.js',
    img: 'public/images/*.{png,jpg,jpeg,gif,webp,svg}',
    test: 'tests',
    server: 'server.js'
  }

  require('time-grunt')(grunt)

  // Project Configuration
  grunt.initConfig({
    paths: paths,
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      dev: {
        src: [ paths.js, '!public/javascripts/bundle.js' ],
        dest: paths.browserified,
        options: {
          browserifyOptions: { 'debug': true },
          watch: true
        }
      }
    },
    concurrent: {
      options: {
        logConcurrentOutput: true
      },
      dev: [ 'watch:livereload', 'watch:sass', 'express:dev' ]
    },
    copy: {
      dev: {
        cwd: 'node_modules/bootstrap-sass/assets/',
        src: [ 'fonts/bootstrap/*' ],
        expand: true,
        dest: paths.vendor
      }
    },
    clean: {
      dev: {
        files: [{
          dot: true,
          src: [
            paths.browserified, 'public/stylesheets/global.css', paths.vendor
          ]
        }]
      }
    },
    express: {
      dev: {
        options: {
          script: paths.server,
          harmony: true,
          port: 9000,
          node_env: 'development',
          debug: true,
          background: false
        }
      }
    },
    sass: {
      options: {
        includePaths: [ 'node_modules/bootstrap-sass/assets/stylesheets/' ]
      },
      dev: {
        files: {
          'public/stylesheets/global.css': paths.scss
        }
      }
    },
    watch: {
      livereload: {
        files: [ paths.jade, paths.css, paths.browserified ],
        tasks: [ ],
        options: {
          livereload: true
        }
      },
      sass: {
        files: [ paths.scss ],
        tasks: [ 'sass:dev' ]
      }
    }
  })

  // Load automatically all the tasks
  require('load-grunt-tasks')(grunt)

  // Build client javascript and copy bootstrap dependencies
  grunt.registerTask('build', [ 'sass:dev', 'newer:browserify:dev', 'newer:copy:dev' ])

  // Start in dev mode (reload front end files without refresh)
  grunt.registerTask('dev', [ 'sass:dev', 'newer:browserify:dev', 'newer:copy:dev', 'concurrent:dev' ])

  // Clean build
  grunt.registerTask('clean', [], function () {
    grunt.loadNpmTasks('grunt-contrib-clean')

    grunt.task.run(
      'clean:dev'
    )
  })
}
