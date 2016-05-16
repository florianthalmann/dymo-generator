var gulp = require('gulp');
var closureCompiler = require('google-closure-compiler').gulp();

gulp.task('default', function () {
	return gulp.src(['./src/*.js'], {base: './'})
	.pipe(closureCompiler({
		//compilation_level: 'ADVANCED_OPTIMIZATIONS',
		compilation_level: 'SIMPLE_OPTIMIZATIONS',
		warning_level: 'VERBOSE',
		externs: './externs.js',
		//generate_exports: true,
		language_in: 'ECMASCRIPT5',
		language_out: 'ECMASCRIPT5',
		js_output_file: 'dymo-generator.min.js'
	}))
	.pipe(gulp.dest('./dist'));
});