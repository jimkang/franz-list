/* global process */

var logFormat = require('log-format');

module.exports = function nonBlockingLog() {
  process.stderr.write(logFormat.apply(logFormat, arguments) + '\n');
};
