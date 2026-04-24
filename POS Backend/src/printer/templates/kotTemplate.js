'use strict';

const EscPosBuilder = require('../escpos');
const config = require('../../config/env');

/**
 *  Kitchen Order Ticket (KOT) template. The kitchen cares about:
 *    • Who ordered (table/parcel)
 *    • WHAT is new (quantity + item name)
 *    • Notes ("no spice", "jain", ...)
 *    • Whether this is the first KOT for the order, or an *additional* run
 *      (flagged loudly as "ADDITIONAL ORDER" so kitchen doesn't confuse it
 *       with the initial ticket and re-cook).
 *
 *   Returns { buffer, trace } — trace is plaintext for debug.
 */
function renderKOT(kot, { width = config.printer.width, station = null } = {}) {
  const b = new EscPosBuilder({ width });
  const traceLines = [];
  const trace = (s = '') => traceLines.push(s);

  const isReprint = kot.kotType === 'REPRINT';
  const isAdditional = !isReprint && kot.batchNumber > 1;

  // If a specific station is given, filter items.
  const items = station
    ? kot.items.filter((it) => (it.kitchenStation || 'main') === station)
    : kot.items;

  if (!items.length) return { buffer: Buffer.alloc(0), trace: '' };

  b.align('CENTER').bold(true).size(EscPosBuilder.SIZE.DOUBLE);
  if (isReprint) {
    b.line('*** REPRINT ***');
  } else if (isAdditional) {
    b.line('ADDITIONAL ORDER');
  } else {
    b.line('KITCHEN ORDER');
  }
  b.size(EscPosBuilder.SIZE.NORMAL).bold(false);

  if (station) {
    b.bold(true).line(`Station: ${station.toUpperCase()}`).bold(false);
  }

  b.rule('=');
  trace(`=== ${isReprint ? 'REPRINT ' : ''}${isAdditional ? 'ADDITIONAL ' : ''}KOT ===`);

  b.align('LEFT');
  b.kv(`KOT: ${kot.kotNumber}`, `Batch: ${kot.batchNumber}`);
  trace(`KOT ${kot.kotNumber}  Batch ${kot.batchNumber}`);

  const type = kot.orderType;
  if (type === 'DINING') {
    b.bold(true).size(EscPosBuilder.SIZE.DOUBLE_HEIGHT);
    b.line(`TABLE: ${kot.tableNumber || '-'}`);
    b.size(EscPosBuilder.SIZE.NORMAL).bold(false);
    trace(`TABLE ${kot.tableNumber}`);
  } else {
    b.bold(true).size(EscPosBuilder.SIZE.DOUBLE_HEIGHT);
    b.line('>>> PARCEL <<<');
    b.size(EscPosBuilder.SIZE.NORMAL).bold(false);
    trace('>>> PARCEL <<<');
  }

  const ts = (kot.createdAt || new Date()).toLocaleString();
  b.kv('Time', ts);
  trace(`Time: ${ts}`);

  b.rule('-');

  b.bold(true).kv('Qty', 'Item').bold(false);
  b.rule('-');
  trace('Qty  Item');
  trace('-----------------------------');

  for (const it of items) {
    const left = String(it.quantity).padStart(3, ' ');
    const name = it.name;
    b.bold(true).line(`${left}  ${name}`).bold(false);
    trace(`${left}  ${name}`);
    if (it.notes) {
      b.text('      ');
      b.wrap(`* ${it.notes}`, { indent: 6 });
      trace(`      * ${it.notes}`);
    }
  }

  b.rule('=');
  trace('=============================');

  if (isAdditional) {
    b.align('CENTER').bold(true).line('ADD TO EXISTING ORDER').bold(false).align('LEFT');
  }

  b.feed(3).cut();
  return { buffer: b.build(), trace: traceLines.join('\n') };
}

/**
 * Split a KOT into per-station render buffers so each kitchen station
 * only receives its own items. Returns a list of { station, buffer, trace }.
 */
function renderKOTPerStation(kot, { width = config.printer.width } = {}) {
  const stations = [...new Set(kot.items.map((it) => (it.kitchenStation || 'main').toLowerCase()))];
  return stations.map((station) => {
    const { buffer, trace } = renderKOT(kot, { width, station });
    return { station, buffer, trace };
  });
}

module.exports = { renderKOT, renderKOTPerStation };
