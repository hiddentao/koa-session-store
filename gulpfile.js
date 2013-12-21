var gulp = require('gulp');
var mocha = require('gulp-mocha');

gulp.task('tests', function () {
  gulp.src('test.js')
    .pipe(mocha({
      ui: 'bdd',
      reporter: 'spec'
    }));
});


// The default task (called when you run `gulp`)
gulp.task('default', function() {
  gulp.run('tests');
});