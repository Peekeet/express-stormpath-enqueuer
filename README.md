# express-stormpath-enqueuer

[![npm version](https://img.shields.io/npm/v/express-stormpath-enqueuer.svg?style=flat)](https://npmjs.org/package/express-stormpath-enqueuer)
[![npm downloads](http://img.shields.io/npm/dm/express-stormpath-enqueuer.svg?style=flat)](https://npmjs.org/package/express-stormpath-enqueuer)

> Ensures changes to user custom data don't overwrite unrelated data due to staleness.


## Installation

```
$ npm install express-stormpath-enqueuer
```


## Usage

### Initialize

```js
var express           = require('express');
var stormpath         = require('express-stormpath');
var stormpathEnqueuer = require('express-stormpath-enqueuer');

var app = express();

app.use(stormpath.init(app, {...}));

stormpathEnqueuer.init(app);
```


### Modify User Data

```js
app.use(stormpath.loginRequired);
app.use(stormpathEnqueuer.populate);

app.get('/', function(req, res, next) {
  req.stormpathEnqueuer.modifyCustomData(
    req.user.href,
    function modify(customData) {
      customData.myProperty = 'something useful';
    },
    function done() {
      console.log('DONE');
      next();
    }
  );
});
```
