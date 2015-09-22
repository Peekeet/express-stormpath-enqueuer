var events = require('events');

function processQueue(queue, dataToModify) {
  var doneCallbacks = [];

  while (queue.length) {
    var atom = queue.shift();

    if (atom.modify) {
      atom.modify(dataToModify);
    }

    if (atom.done) {
      doneCallbacks.push(atom.done);
    }
  }

  return doneCallbacks;
}

function modifyData(userHref, dataToModify, queue, emitter) {
  var doneCallbacks = processQueue(queue, dataToModify);

  dataToModify.save(function(err, user) {
    doneCallbacks.forEach(function(callback) {
      callback(err, user);
    });

    queue.lock = false;

    emitter.emit('doneSaving', userHref);
  });
}

function executeQueue(queue, userHref, app, emitter) {
  if (!queue.length) {
    return;
  }

  var client = app.get('stormpathClient');

  if (!client) {
    app.once('stormpath.ready', function() {
      if (queue.lock) {
        return;
      }

      executeQueue(queue, userHref, app, emitter);
    });

    return;
  }

  queue.lock = true;

  var options = {
    expand: 'customData',
  };

  client.getAccount(userHref, options, function(err, account) {
    modifyData(userHref, account.customData, queue, emitter);
  });
}

var Enqueuer = function(app) {
  var customDataQueues = {};
  var emitter = new events.EventEmitter();

  emitter.on('doneSaving', function(userHref) {
    executeQueue(customDataQueues[userHref], userHref, app, emitter);
  });

  this.customDataQueues = customDataQueues;
  this.emitter = emitter;
  this.app = app;
};

Enqueuer.prototype = {
  populate: function(req) {
    req.stormpathEnqueuer = this;
  },

  modifyCustomData: function(userHref, modifyCallback, doneCallback) {
    var queue = this.customDataQueues[userHref];
    if (!queue) {
      queue = [];
      queue.lock = false;

      this.customDataQueues[userHref] = queue;
    }

    queue.push({
      modify: modifyCallback,
      done:   doneCallback,
    });

    if (queue.lock) {
      return;
    }

    executeQueue(queue, userHref, this.app, this.emitter);
  },
};

var enqueuer = {
  init: function(app) {
    app.set('stormpathEnqueuer', new Enqueuer(app));
  },

  populate: function(req, res, next) {
    var enq = req.app.get('stormpathEnqueuer');

    enq.populate(req);

    next();
  }
};

module.exports = enqueuer;
