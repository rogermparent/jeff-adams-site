import gulp from "gulp";
import {spawn} from "child_process";
import hugoBin from "hugo-bin";
import gutil from "gulp-util";
import flatten from "gulp-flatten";
import postcss from "gulp-postcss";
import cssImport from "postcss-import";
import cssnext from "postcss-cssnext";
import cssExtend from "postcss-extend";
import cssNested from "postcss-nested";
import BrowserSync from "browser-sync";
import webpack from "webpack";
import imageResize from "gulp-image-resize";
import imagemin from "gulp-imagemin";
import cleancss from "gulp-clean-css";
import htmlmin from "gulp-htmlmin";
import newer from "gulp-newer";
import frontmatter from "gray-matter";
import webpackConfig from "./webpack.conf";
import fs from "fs";

const browserSync = BrowserSync.create();

// Hugo arguments
const hugoArgsDefault = ["-d", "../dist", "-s", "site", "-v"];
const hugoArgsPreview = ["--buildDrafts", "--buildFuture"];

gulp.task("assets", ["css", "js", "fonts", "images"]);

// Development tasks
gulp.task("hugo", (cb) => buildSite(cb));
gulp.task("hugo-preview", (cb) => buildSite(cb, hugoArgsPreview));

// Run server tasks
gulp.task("server", ["hugo", "assets"], (cb) => runServer(cb));
gulp.task("server-preview", ["hugo-preview", "assets"], (cb) => runServer(cb));

// Build/production tasks
gulp.task("htmlmin", ["hugo-production"], () => {
    gulp.src("./dist/*.html")
	.pipe(htmlmin({collapseWhitespace: true}))
	.pipe(gulp.dest('./dist'));
});
gulp.task("build", ["htmlmin"]);
gulp.task("hugo-production", ["assets"], (cb) => buildSite(cb, [], "production"));
gulp.task("build-preview", ["assets"], (cb) => buildSite(cb, hugoArgsPreview, "production"));

// Compile CSS with PostCSS
gulp.task("css", () => (
    gulp.src("./src/css/*.css")
        .pipe(postcss([
            cssImport({from: "./src/css/main.css"}),
            cssExtend(),
            cssNested(),
            cssnext(),
            require('postcss-simple-vars'),
        ]))
	.pipe(cleancss())
        .pipe(gulp.dest("./dist/css"))
        .pipe(browserSync.stream())
));

// Compile Javascript
gulp.task("js", (cb) => {
    const myConfig = Object.assign({}, webpackConfig);

    webpack(myConfig, (err, stats) => {
        if (err) throw new gutil.PluginError("webpack", err);
        gutil.log("[webpack]", stats.toString({
            colors: true,
            progress: true
        }));
        browserSync.reload();
        cb();
    });
});

// Move all fonts in a flattened directory
gulp.task('fonts', () => (
    gulp.src("./src/fonts/**/*")
        .pipe(flatten())
        .pipe(gulp.dest("./dist/fonts"))
        .pipe(browserSync.stream())
));

// Clean images

// Optimize images
const imagePath = "./dist/images";
gulp.task('images:optimize', () => (
    gulp.src("./src/images/**/*", {nodir: true })
	.pipe(newer(imagePath))
	.pipe(imagemin())
	.pipe(gulp.dest(imagePath))
));

// Generate image thumbnails
const thumbPath = './dist/images/thumbnails';
const galleryPage = './site/content/photos.md';
gulp.task('images:thumbnails', () => {
    
    const galleryFiles = frontmatter(
        fs.readFileSync('./site/content/photos.md')
    ).data.gallery.map((item) => {
        return('./src' + item.image);
    });

    gulp.src(galleryFiles, {
        nodir: true,
        base: "./src/images",
    })
	.pipe(newer(thumbPath))
	.pipe(imageResize({
	    width: 250,
	    height: 200,
	    crop: true,
	    upscale: true,
	    cover: true,
            gravity: 'center'
	}))
	.pipe(imagemin())
	.pipe(gulp.dest(thumbPath))
});

gulp.task('images', ['images:optimize', 'images:thumbnails']);

// Development server with browsersync
function runServer() {
    browserSync.init({
        server: {
            baseDir: "./dist"
        }
    });
    gulp.watch("./src/js/**/*.js", ["js"]);
    gulp.watch("./src/css/**/*.css", ["css"]);
    gulp.watch("./src/fonts/**/*", ["fonts"]);
    gulp.watch("./src/images/**/*", ["images"]);
    gulp.watch("./site/**/*", ["hugo"]);
};

/**
 * Run hugo and build the site
 */
function buildSite(cb, options, environment = "development") {
    const args = options ? hugoArgsDefault.concat(options) : hugoArgsDefault;

    process.env.NODE_ENV = environment;

    return spawn(hugoBin, args, {stdio: "inherit"}).on("close", (code) => {
        if (code === 0) {
            browserSync.reload();
            cb();
        } else {
            browserSync.notify("Hugo build failed :(");
            cb("Hugo build failed");
        }
    });
}
