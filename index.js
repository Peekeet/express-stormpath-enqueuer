var events = require('events');

var processQueue = function processQueue(queue, dataToModify) {
  var onCompleteCallbacks = [];

  while (queue.length) {
    var atom = queue.shift();

    if (atom.modify) {
      atom.modify(dataToModify);
    }

    if (atom.done) {
      onCompleteCallbacks.push(atom.done);
    }
  }

  return onCompleteCallbacks;
};

var modifyData = function modifyData(accountHref, dataToModify, queue, emitter) {
  var onCompleteCallbacks = processQueue(queue, dataToModify);

  dataToModify.save(function finishSaving(err, account) {
    onCompleteCallbacks.forEach(function executeCallback(callback) {
      callback(err, account);
    });

    queue.lock = false;

    emitter.emit('doneSaving', accountHref);
  });
};

var executeQueue = function executeQueue(queue, accountHref, app, emitter) {
  if (!queue.length) {
    return;
  }

  var client = app.get('stormpathClient');

  if (!client) {
    app.once('stormpath.ready', function retryExecuteQueue() {
      if (queue.lock) {
        return;
      }

      executeQueue(queue, accountHref, app, emitter);
    });

    return;
  }

  queue.lock = true;

  var options = {
    expand: 'customData',
  };

  client.getAccount(accountHref, options, function modifyAccountData(err, account) {
    if (err) {
      queue.lock = false;

      return executeQueue(queue, accountHref, app, emitter);
    }

    modifyData(accountHref, account.customData, queue, emitter);
  });
};

var Enqueuer = function newEnqueuer(app) {
  var customDataQueues = {};
  var emitter = new events.EventEmitter();

  emitter.on('doneSaving', function executeAccountQueue(accountHref) {
    executeQueue(customDataQueues[accountHref], accountHref, app, emitter);
  });

  this.customDataQueues = customDataQueues;
  this.emitter = emitter;
  this.app = app;
};

Enqueuer.prototype = {
  populate: function populate(req) {
    req.stormpathEnqueuer = this;
  },

  modifyCustomData: function modifyCustomData(accountHref, modifyCallback, doneCallback) {
    var queue = this.customDataQueues[accountHref];

    if (!queue) {
      queue = [];
      queue.lock = false;

      this.customDataQueues[accountHref] = queue;
    }

    queue.push({
      modify: modifyCallback,
      done:   doneCallback,
    });

    if (queue.lock) {
      return;
    }

    executeQueue(queue, accountHref, this.app, this.emitter);
  },
};

var enqueuer = {
  init: function init(app) {
    app.set('stormpathEnqueuer', new Enqueuer(app));
  },

  populate: function populate(req, res, next) {
    var enq = req.app.get('stormpathEnqueuer');

    enq.populate(req);

    next();
  },
};

module.exports = enqueuer;
