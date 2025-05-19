#!/usr/bin/env node

/* global process */
var nonBlockingLog = require('./non-blocking-log');
var logFormat = require('log-format');
var ListService = require('./list-service');
var http = require('http');
var { sendMailWithSendmail } = require('./senders/sendmail-sender');
require('dotenv').config();

const port = 6667;

ListService(
  {
    storePath: process.env.STORE_PATH,
    serviceBaseURL: 'https://smidgeo.com/franz-list',
    sendMail: sendMailWithSendmail,
  },
  createServer,
);

function createServer(error, { app }) {
  nonBlockingLog('Starting service.\n');

  if (error) {
    process.stderr.write(logFormat(error.message, error.stack));
    process.exit(1);
    return;
  }

  var server = http.createServer(app);
  server.listen(port, onReady);
  return server;

  function onReady(error) {
    if (error) {
      logError(error);
    } else {
      nonBlockingLog('Service listening at', port);
    }
  }
}

function logError(error) {
  process.stderr.write(logFormat(error.message, error.stack));
}
