"use strict";

const { read } = require("./read");
const { write } = require("./write");
const { append } = require("./append");
const { clear } = require("./clear");
const { batchGet } = require("./batchGet");
const { batchWrite } = require("./batchWrite");
const { highlight } = require("./highlight");
const { unhighlight } = require("./unhighlight");
const { format } = require("./format");
const { getFormat } = require("./getFormat");
const { borders } = require("./borders");
const { merge } = require("./merge");
const { unmerge } = require("./unmerge");
const { resize } = require("./resize");
const { autoResize } = require("./autoResize");
const { freeze } = require("./freeze");
const { copyFormat } = require("./copyFormat");
const { create } = require("./create");
const { info } = require("./info");
const { addSheet } = require("./addSheet");
const { deleteSheet } = require("./deleteSheet");
const { renameSheet } = require("./renameSheet");
const { batch } = require("./batch");
const { allUpdatesCleaning } = require("./allUpdatesCleaning");
const { lease } = require("./lease");
const { addApartment } = require("./addApartment");
const {
  generateRentReconciliationReport,
} = require("./generateRentReconciliationReport");
const {
  getRentReconciliationReport,
} = require("./getRentReconciliationReport");
const { getUnpaidRentReport } = require("./getUnpaidRentReport");

module.exports = {
  read,
  write,
  append,
  clear,
  batchGet,
  batchWrite,
  highlight,
  unhighlight,
  format,
  getFormat,
  borders,
  merge,
  unmerge,
  resize,
  autoResize,
  freeze,
  copyFormat,
  create,
  info,
  addSheet,
  deleteSheet,
  renameSheet,
  batch,
  allUpdatesCleaning,
  lease,
  "Add apartment": addApartment,
  generate_rent_reconciliation_report: generateRentReconciliationReport,
  get_rent_reconciliation_report: getRentReconciliationReport,
  get_unpaid_rent_report: getUnpaidRentReport,
};
