'use strict'

module.exports = function (grunt) {
  var paths = {
    dist: 'dist',
    tmp: '.tmp',
    jade: 'views/**/**/*.jade',
    css: 'public/stylesheets/*.css',
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
      },
      dist: {
        src: [ paths.js ],
        dest: paths.browserified
      }
    },
    copy: {
      dev: {
        cwd: 'node_modules/bootstrap/dist/',
        src: [ 'css/*', 'fonts/*' ],
        expand: true,
        dest: paths.vendor
      }
    },
    clean: {
      dev: {
        files: [{
          dot: true,
          src: [
            paths.browserified
          ]
        }]
      },
      dist: {
        files: [{
          dot: true,
          src: [
            paths.tmp,
            paths.browserified,
            '<%= paths.dist %>/*',
            '!<%= paths.dist %>/.git*'
          ]
        }]
      }
    },
    csslint: {
      options: {
        csslintrc: '.csslintrc'
      },
      src: paths.css
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
      },
      test: {
        options: {
          script: paths.server,
          harmony: true,
          port: 9000,
          node_env: 'test',
          background: true,
          debug: false
        }
      },
      prod: {
        options: {
          script: paths.server,
          harmony: true,
          port: 9000,
          node_env: 'production',
          background: false,
          debug: false
        }
      }
    },
    filerev: {
      options: {
        copy: false
      },
      dist: {
        cwd: 'dist',
        src: [ paths.js, paths.css, paths.img ],
        dest: 'dist',
        expand: true
      }
    },
    htmlmin: {
      dist: {
        options: {
          removeComments: true,
          collapseWhitespace: true
        },
        files: [ {
          expand: true,
          src: [ '<%= paths.dist %>/views/**/**/*.html' ]
        } ]
      }
    },
    imagemin: {
      dist: {
        files: [{
          expand: true,
          cwd: './public/images',
          src: '*.{png,jpg,jpeg}',
          dest: '<%= paths.dist %>/public/images'
        }]
      }
    },
    jade: {
      dist: {
        options: {
          pretty: true
        },
        files: [ {
          src: '**/*.jade',
          dest: '<%= paths.dist %>/views',
          ext: '.html',
          cwd: './views',
          expand: true
        } ]
      }
    },
    jshint: {
      all: {
        src: paths.js,
        options: {
          jshintrc: true
        }
      }
    },
    usemin: {
      html: [ '<%= paths.dist %>/views/**/**/*.html' ],
      css: [ '<%= paths.dist %>/public/stylesheets/*.css' ],
      options: {
        assetsDirs: [ '<%= paths.dist %>/public' ]
      }
    },
    useminPrepare: {
      html: '<%= paths.dist %>/views/index.html',
      options: {
        root: 'public',
        dest: '<%= paths.dist %>/public'
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
    grunt.loadNpmTasks('grunt-browserify')
    grunt.loadNpmTasks('grunt-contrib-copy')
    grunt.loadNpmTasks('grunt-newer')

    grunt.task.run(
      'newer:browserify:dev',
      'newer:copy:dev'
    )
  })

  // Start in dev mode (reload front end files without refresh)
  grunt.registerTask('dev', [], function () {
    grunt.loadNpmTasks('grunt-browserify')
    grunt.loadNpmTasks('grunt-contrib-watch')
    grunt.loadNpmTasks('grunt-express-server')
    grunt.loadNpmTasks('grunt-contrib-copy')
    grunt.loadNpmTasks('grunt-newer')

    grunt.task.run(
      'newer:browserify:dev',
      'newer:copy:dev',
      'express:dev',
      'watch'
    )
  })

  // TODO
  // Build dist directory for production

  // Clean build
  grunt.registerTask('clean', [], function () {
    grunt.loadNpmTasks('grunt-contrib-clean')

    grunt.task.run(
      'clean:dist'
    )
  })
}
