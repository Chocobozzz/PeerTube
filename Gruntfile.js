'use strict'

module.exports = function (grunt) {
  var paths = {
    dist: 'dist',
    jade: 'views/**/**/*.jade',
    css: 'public/stylesheets/*.css',
    scss: 'public/stylesheets/*.scss',
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
          background: true
        }
      }
    },
    sass: {
      dev: {
        files: {
          'public/stylesheets/global.css': paths.scss
        }
      }
    },
    watch: {
      express: {
        files: [ paths.main, paths.routes, paths.src ],
        tasks: [ 'express:dev' ],
        options: {
          livereload: true,
          spawn: false
        }
      },
      dev: {
        files: [ paths.jade, paths.css, paths.browserified ],
        options: {
          livereload: true,
          nospawn: false
        }
      }
    }
  })

  // Build client javascript and copy bootstrap dependencies
  grunt.registerTask('build', [], function () {
    grunt.loadNpmTasks('grunt-sass')
    grunt.loadNpmTasks('grunt-browserify')
    grunt.loadNpmTasks('grunt-contrib-copy')
    grunt.loadNpmTasks('grunt-newer')

    // TODO: SASS --> newer
    grunt.task.run(
      'sass:dev',
      'newer:browserify:dev',
      'newer:copy:dev'
    )
  })

  // Start in dev mode (reload front end files without refresh)
  grunt.registerTask('dev', [], function () {
    grunt.loadNpmTasks('grunt-sass')
    grunt.loadNpmTasks('grunt-browserify')
    grunt.loadNpmTasks('grunt-contrib-watch')
    grunt.loadNpmTasks('grunt-express-server')
    grunt.loadNpmTasks('grunt-contrib-copy')
    grunt.loadNpmTasks('grunt-newer')

    // TODO: SASS --> newer
    grunt.task.run(
      'sass:dev',
      'newer:browserify:dev',
      'newer:copy:dev',
      'express:dev',
      'watch'
    )
  })

  // Clean build
  grunt.registerTask('clean', [], function () {
    grunt.loadNpmTasks('grunt-contrib-clean')

    grunt.task.run(
      'clean:dev'
    )
  })
}
