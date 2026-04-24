'use strict';

const net = require('net');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Printer transports. Three modes are supported:
 *
 *   network - sends the raw ESC/POS buffer to a TCP socket (RAW on port
 *             9100 works for virtually every LAN thermal printer).
 *   usb     - uses the `escpos` + `escpos-usb` packages when available.
 *             Kept optional so the backend still boots on dev machines
 *             without libusb.
 *   file    - writes a binary file + a .txt debug trace to PRINTER_FILE_DIR.
 *             This is the default for local development.
 *
 * All transports implement a single `send(buffer)` method and expose a
 * stable error surface — the service layer just catches and records
 * failures.
 */

class FileTransport {
  constructor({ dir = './print-queue', label = 'printer' }) {
    this.dir = dir;
    this.label = label;
  }
  async send(buffer, { trace = '' } = {}) {
    await fs.mkdir(this.dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(this.dir, `${ts}-${this.label}`);
    await fs.writeFile(`${base}.bin`, buffer);
    if (trace) await fs.writeFile(`${base}.txt`, trace);
    logger.info(`[printer:${this.label}] wrote ${base}.bin (${buffer.length} bytes)`);
  }
}

class NetworkTransport {
  constructor({ host, port = 9100, timeout = 5000, label = 'printer' }) {
    if (!host) throw new Error(`[${label}] network printer host not configured`);
    this.host = host;
    this.port = port;
    this.timeout = timeout;
    this.label = label;
  }
  send(buffer) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {}
        if (err) reject(err);
        else resolve();
      };
      socket.setTimeout(this.timeout);
      socket.on('timeout', () => done(new Error(`[${this.label}] printer timed out`)));
      socket.on('error', done);
      socket.connect(this.port, this.host, () => {
        socket.write(buffer, (err) => {
          if (err) return done(err);
          socket.end();
        });
      });
      socket.on('close', () => done(null));
    });
  }
}

class UsbTransport {
  constructor({ vendorId, productId, label = 'printer' }) {
    this.vendorId = vendorId;
    this.productId = productId;
    this.label = label;
    this._driver = null;
  }
  _load() {
    if (this._driver) return this._driver;
    try {
      /* eslint-disable global-require */
      const escpos = require('escpos');
      escpos.USB = require('escpos-usb');
      /* eslint-enable global-require */
      this._driver = escpos;
      return escpos;
    } catch (err) {
      throw new Error(
        `[${this.label}] USB printer support requires 'escpos' and 'escpos-usb' — install optional deps`,
      );
    }
  }
  send(buffer) {
    const escpos = this._load();
    return new Promise((resolve, reject) => {
      let device;
      try {
        device = this.vendorId
          ? new escpos.USB(parseInt(this.vendorId, 16), parseInt(this.productId, 16))
          : new escpos.USB();
      } catch (err) {
        return reject(err);
      }
      device.open((err) => {
        if (err) return reject(err);
        device.write(buffer, (werr) => {
          if (werr) return reject(werr);
          try {
            device.close(() => resolve());
          } catch (e) {
            resolve();
          }
        });
      });
    });
  }
}

function makeTransport(kind, opts) {
  switch ((kind || 'file').toLowerCase()) {
    case 'network':
      return new NetworkTransport(opts);
    case 'usb':
      return new UsbTransport(opts);
    case 'file':
    default:
      return new FileTransport(opts);
  }
}

module.exports = { makeTransport, FileTransport, NetworkTransport, UsbTransport };
