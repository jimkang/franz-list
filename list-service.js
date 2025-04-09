/* global process */
var express = require('express');
var cors = require('cors');
var { getTokenPermissions } = require('./token-store');

function ListService(done) {
  var app = express();

  app.use(cors());

  app.get('/health', respondOK);
  app.get('/token/:token/list/:listId/show', cors(), showList);
  app.head(/.*/, respondHead);

  process.nextTick(done, null, { app });

  function respondOK(req, res) {
    res.status(204).send();
  }

  async function showList(req, res) {
    if (!req.params.token) {
      res.status(400).json({ message: 'Missing `token` in path.' });
      return;
    }
    if (!req.params.listId) {
      res.status(400).json({ message: 'Missing `listId` in path.' });
      return;
    }

    var permissions = getTokenPermissions(req.params.token);
    var permittedLists = permissions?.read?.list;
    if (!permittedLists) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    if (!permittedLists.includes(req.params.listId)) {
      res.status(401).json({ message: 'Not allowed' });
      return;
    }

    if (req.params.listId === 'a') {
      res.status(200).json({ list: ['item 1', 'item 2'] });
      return;
    }

    res.status(200).send('OK!');
  }

  function respondHead(req, res) {
    if (req.method !== 'OPTIONS') {
      res.writeHead(200, {
        'content-type': 'application/json',
      });
    } else {
      res.writeHead(200, 'OK');
    }
    res.end();
  }
}

module.exports = ListService;
