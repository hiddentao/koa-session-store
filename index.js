var _ = require('lodash');
var debug = require('debug')('koa-session-store');
var uid = require('uid2');


/**
 * Create session middleware.
 *
 * @param opts {Object} session options.
 * @param opts.name {String} session cookie name. Defaults to "koa:sess".
 * @param opts.store {Object|String} either an instance of session storage implementation or the string 'cookie'. Default is 'cookie'.
 * @parma opts.cookie {Object} configuration options for the cookie handler (see https://github.com/jed/cookies#cookiesset-name--value---options--).
 *
 * @return {Function} middleware.
 */
module.exports = function(opts){
  opts = opts || {};

  // key
  opts.name = opts.name || 'koa:sess';

  // cookie
  if (!opts.cookie) {
    opts.cookie = {
      httpOnly: true,
      signed: true,
      overwrite: true
    }
  }

  debug('session options %j', opts);

  return function *(next){
    var session = new Session(this, opts);

    this.session = yield session.getData();

    yield next;

    if (!this.session) {
      return yield session.remove();
    }

    yield session.save();
  }
};





/**
 * Session.
 *
 * @param ctx {Context}
 * @param opts {Object} options.
 * @api private
 */

function Session(ctx, opts) {
  this._ctx = ctx;

  opts = opts || {};

  this._name = opts.name;

  this._cookieOpts = opts.cookie;

  // load session cookie data
  this._jsonString = this._ctx.cookies.get(this._name, this._cookieOpts);
  this._json = JSON.parse(this._jsonString || '{}');

  debug('load cookie %j', this._jsonString);

  // new session?
  if (!this._json._sid) {
    this._isNew = true;
    this._sid = uid(15);
  } else {
    this._sid = this._json._sid;
  }

  this._store = opts.store || 'cookie';
}


/**
 * Get the session data object.
 *
 * This will load the data from the session store.
 *
 * @return {Object} the session data object.
 *
 * @api private
 */
Session.prototype.getData = function*() {
  if ('cookie' === this._store) {
    // use the cookie itself as the store
    this._useCookieStore = true;
    this._sessionData = _.extend({}, this._json);
    this._prevSessionDataJSON = this._jsonString;
    debug('use cookie as store');
  } else {
    debug('load store for %d', this._sid);
    this._prevSessionDataJSON = yield this._store.load(this._sid);
    this._sessionData = JSON.parse(this._prevSessionDataJSON);
  }

  return this._sessionData;
};



/**
 * Save session changes.
 *
 * NOTE: this calls save on the session store and sets the cookie if it hasn't already been set.
 *
 * @api private
 */

Session.prototype.save = function*() {
  this._sessionData._sid = this._sid; // in case app overwrote it by accident when using cookie store

  var newJSON = JSON.stringify(this._sessionData),
    changed = (this._prevSessionDataJSON !== newJSON);

  if (changed) {
    // if non-cookie store then save the data
    if (!this._useCookieStore) {
      debug('save data to store for %d %j', this._sid, newJSON);
      yield this._store.save(this._sid, newJSON);
    }

    // if using cookie store or if this is a new session
    if (this._useCookieStore || this._isNew) {
      debug('save cookie %s', newJSON);
      this._ctx.cookies.set(this._name, newJSON, this._cookieOpts);
    }
  }
};

/**
 * Remove the session.
 *
 * @api private
 */

Session.prototype.remove = function*(){
  debug('remove');
  if (!this._useCookieStore) {
    yield this._store.remove(this._sid);
  }
  this._cookieOpts.expires = new Date(0);
  this._ctx.cookies.set(this._name, '', this._cookieOpts);
};

