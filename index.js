var _ = require('lodash');
var debug = require('debug')('koa-session-store');
var uid = require('uid2');


/**
 * Create session middleware.
 *
 * @param opts {Object} session options.
 * @param opts.key {String} session cookie name. Defaults to "koa:sess".
 * @param opts.store {Object|String} either an instance of session storage implementation or the string 'cookie'. Default is 'cookie'.
 * @parma opts.cookie {Object} configuration options for the cookie handler (see https://github.com/jed/cookies#cookiesset-name--value---options--).
 *
 * @return {Function} middleware.
 */
exports.create = function(opts){
  opts = opts || {};

  // key
  opts.key = opts.key || 'koa:sess';

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

    this.session = yield session.initStore();

    yield next;

    if (!this.session) {
      return yield session.remove();
    }

    yield session.save();
  }
};





/**
 * Session model.
 *
 * @param ctx {Context}
 * @param opts {Object} options.
 * @api private
 */

function Session(ctx, opts) {
  this._ctx = ctx;

  opts = opts || {};

  this._key = opts.key;

  this._cookieOpts = opts.cookie;

  // load session cookie data
  var jsonString = this._ctx.cookies.get(this._key, this._cookieOpts),
    json = JSON.parse(jsonString || '{}');

  // new session?
  if (!json._sid) {
    this._isNew = true;
    this._sid = uid(15);
  } else {
    this._sid = json._sid;
  }

  // get session store
  this._store = opts.store;
  if (!this._store || 'cookie' === this._store) {
    // use the cookie itself as the store
    this._useCookieStore = true;
    this._store = _.extend({}, json);
    this._prevSessionData = jsonString;
  }
}


/**
 * Initialize the session store.
 * @return {Object} the session store.
 */
Session.prototype.initStore = function*() {
  if (!this._useCookieStore) {
    yield this._store.load(this._sid);
  }

  return this._opts.store;
};



/**
 * JSON representation of the session.
 *
 * @return {Object}
 * @api public
 */

Session.prototype.inspect =
  Session.prototype.toJSON = function() {
    return JSON.stringify(this._store);
  };




/**
 * Save session changes.
 *
 * NOTE: this calls save on the session store and sets the cookie if it hasn't already been set.
 *
 * @api private
 */

Session.prototype.save = function*() {
  var json, changed;

  // using cookie store?
  if (this._useCookieStore) {
    this._store._sid = this._sid; // in case app overwrote it by accident
    json = JSON.stringify(this._store);
    changed = (this._prevSessionData !== json);
  } else {
    json = {
      _sid: this._sid
    };
    changed = yield this._store.save();
  }

  if (changed || this._isNew) {
    debug('save %s', json);
    this._ctx.cookies.set(this._key, json, this._cookieOpts);
  }
};

/**
 * Remove the session.
 *
 * @api private
 */

Session.prototype.remove = function*(){
  debug('remove');
  yield this._store.remove();
  this._cookieOpts.expires = new Date(0);
  this._ctx.cookies.set(this._key, '', this._cookieOpts);
};

