const bankConfig = require('../../config/bankConfig');

function initPagesWithoutHeaders(rawItemsByPage, bankName) {
  if (bankConfig.banksToIncludeParitalMergeHeadersWithoutParitalHeaders.includes(bankName)) {
    return Object.entries(rawItemsByPage);
  }
  return [];
}

module.exports = { initPagesWithoutHeaders };
