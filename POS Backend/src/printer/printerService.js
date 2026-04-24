'use strict';

const config = require('../config/env');
const logger = require('../utils/logger');
const { makeTransport } = require('./transports');
const { renderKOT, renderKOTPerStation } = require('./templates/kotTemplate');
const { renderBill } = require('./templates/billTemplate');

/**
 * Central print service. Routes:
 *   • KOT  → kitchen printer(s).
 *           If the KOT spans multiple stations, we render per-station
 *           and send a copy to each (same transport for now; extend by
 *           mapping station → transport for production kitchens).
 *   • BILL → counter printer.
 *
 * A tiny in-process queue (per transport) prevents concurrent writes to
 * the same printer from overlapping — thermal printers are not safe for
 * parallel RAW writes.
 */

class PrintQueue {
  constructor() {
    this.tail = Promise.resolve();
  }
  enqueue(task) {
    const next = this.tail.then(() => task()).catch((err) => {
      logger.error('Print task failed', { error: err.message });
      throw err;
    });
    this.tail = next.catch(() => {});
    return next;
  }
}

const kitchenTransport = makeTransport(config.printer.mode, {
  dir: config.printer.fileDir,
  label: 'kitchen',
  host: config.printer.kitchen.host,
  port: config.printer.kitchen.port,
  vendorId: config.printer.kitchen.vendorId,
  productId: config.printer.kitchen.productId,
});

const counterTransport = makeTransport(config.printer.mode, {
  dir: config.printer.fileDir,
  label: 'counter',
  host: config.printer.counter.host,
  port: config.printer.counter.port,
  vendorId: config.printer.counter.vendorId,
  productId: config.printer.counter.productId,
});

const kitchenQueue = new PrintQueue();
const counterQueue = new PrintQueue();

async function printKOT(kot) {
  const perStation = renderKOTPerStation(kot, { width: config.printer.width });
  if (perStation.length <= 1) {
    const { buffer, trace } = renderKOT(kot, { width: config.printer.width });
    if (!buffer.length) return;
    return kitchenQueue.enqueue(() => kitchenTransport.send(buffer, { trace }));
  }
  // Multi-station: send each station's slip sequentially.
  for (const slip of perStation) {
    if (!slip.buffer.length) continue;
    await kitchenQueue.enqueue(() =>
      kitchenTransport.send(slip.buffer, { trace: slip.trace }),
    );
  }
}

async function printBill(bill, { reprint = false } = {}) {
  const { buffer, trace } = renderBill(bill, { width: config.printer.width, reprint });
  return counterQueue.enqueue(() => counterTransport.send(buffer, { trace }));
}

/** Test utility: print "HELLO" on a given printer. */
async function printTest(target = 'counter') {
  const EscPosBuilder = require('./escpos');
  const b = new EscPosBuilder({ width: config.printer.width });
  b.align('CENTER').bold(true).size(EscPosBuilder.SIZE.DOUBLE);
  b.line('PRINTER TEST');
  b.size(EscPosBuilder.SIZE.NORMAL).bold(false);
  b.line(new Date().toLocaleString());
  b.rule('-');
  b.line(`Target: ${target}`);
  b.feed(2).cut();

  const buf = b.build();
  if (target === 'kitchen') {
    return kitchenQueue.enqueue(() => kitchenTransport.send(buf, { trace: 'TEST' }));
  }
  return counterQueue.enqueue(() => counterTransport.send(buf, { trace: 'TEST' }));
}

module.exports = { printKOT, printBill, printTest };
