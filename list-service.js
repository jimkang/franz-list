/* global process */
var express = require('express');
var cors = require('cors');
var noThrowJSONParse = require('no-throw-json-parse');

function ListService(done) {
  var webimage;
  var app = express();

  app.use(cors());

  app.get('/health', respondOK);
  app.get('/list/:listId/show', cors(), showList);
  app.head(/.*/, respondHead);

  process.nextTick(done);

  function respondOK(req, res) {
    res.status(204).send();
  }

  async function showList(req, res) {
    if (!req.params.listId) {
      res.status(400).json({ message: 'Missing `listId` in path.' });
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
