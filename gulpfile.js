var gulp = require('gulp');
var mocha = require('gulp-mocha');

gulp.task('tests', function () {
  gulp.src('test.js')
    .pipe(mocha({
      ui: 'bdd',
      reporter: 'spec'
    }));
});


gulp.task('default', ['tests'], function() {});
