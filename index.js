var absolute = require('absolute');
var assert = require('assert');
var clone = require('clone');
var fs = require('fs');
var fse = require('co-fs-extra');
var is = require('is');
var matter = require('gray-matter');
var Mode = require('stat-mode');
var path = require('path');
var readdir = require('recursive-readdir');
var rm = require('rimraf');
var thunkify = require('thunkify');
var unyield = require('unyield');
var utf8 = require('is-utf8');
var Metalsmith = require('metalsmith')

rm = thunkify(rm);

Metalsmith.prototype.clean = function(clean){
  if (!arguments.length) return this._clean;
  assert(is.boolean(clean) || is.object(clean), 'You must pass boolean or object.');
  this._clean = clean
  return this;
}

Metalsmith.prototype.frontmatter = function(frontmatter){
  if (!arguments.length) return this._frontmatter;
  assert(is.boolean(frontmatter) || is.object(frontmatter), 'You must pass boolean or object.');
  this._frontmatter = frontmatter;
  return this;
};

Metalsmith.prototype.readFile = unyield(function*(file){
  var src = this.source();
  var ret = {};

  if (!absolute(file)) file = path.resolve(src, file);

  try {
    var frontmatter = clone(this.frontmatter());
    var stats = yield fse.stat(file);
    var buffer = yield fse.readFile(file);
    var parsed;
    var enabled;

    if (is.boolean(frontmatter)) {
      enabled = frontmatter;
      frontmatter = {};
    } else if (is.object(frontmatter)) {
      enabled = frontmatter.parse;
      delete frontmatter.parse;
    }

    if (enabled && utf8(buffer)) {
      try {
        parsed = matter(buffer.toString(), frontmatter);
      } catch (e) {
        //var err = new Error('Invalid frontmatter in the file at: ' + file);
        //err.code = 'invalid_frontmatter';
        throw e;
      }

      ret = parsed.data;
      ret.contents = new Buffer(parsed.content);
    } else {
      ret.contents = buffer;
    }

    ret.mode = Mode(stats).toOctal();
    ret.stats = stats;
  } catch (e) {
    if (e.code == 'invalid_frontmatter') throw e;
    e.message = 'Failed to read the file at: ' + file + '\n\n' + e.message;
    e.code = 'failed_read';
    throw e;
  }

  return ret;
});

Metalsmith.prototype.build = unyield(function*(){
  var clean = this.clean();
  var dest = this.destination();
  if (is.boolean(clean) || is.object(clean)) {
    var contents = fs.readdirSync(dest);
    for (var i = 0; i < contents.length; i++) {
      var f = contents[i];
      if (clean.exclude.indexOf(f) === -1) yield rm(path.join(dest, f));
    }
  }
  var files = yield this.read();
  files = yield this.run(files);
  yield this.write(files);
  return files;
})

module.exports = Metalsmith
