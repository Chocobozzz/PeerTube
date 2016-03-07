'use strict'

module.exports = function (grunt) {
  var paths = {
    css: 'client/stylesheets/*.css',
    scss: 'client/stylesheets/application.scss',
    vendor: 'client/stylesheets/vendor',
    routes: './server/controllers/**/*.js',
    main: './server.js',
    img: 'public/images/*.{png,jpg,jpeg,gif,webp,svg}',
    test: 'tests',
    server: 'server.js'
  }

  require('time-grunt')(grunt)

  // Project Configuration
  grunt.initConfig({
    paths: paths,
    pkg: grunt.file.readJSON('package.json'),
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
          'client/stylesheets/global.css': paths.scss
        }
      }
    }
  })

  // Load automatically all the tasks
  require('load-grunt-tasks')(grunt)

  // Build client javascript and copy bootstrap dependencies
  grunt.registerTask('build', [ 'sass:dev', 'newer:copy:dev' ])

  // Clean build
  grunt.registerTask('clean', [], function () {
    grunt.loadNpmTasks('grunt-contrib-clean')

    grunt.task.run(
      'clean:dev'
    )
  })
}
