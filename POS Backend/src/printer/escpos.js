'use strict';

/**
 * Minimal hand-rolled ESC/POS command builder.
 *
 * The `escpos` npm package bundles native USB/serial bindings that refuse
 * to load on many machines (Apple Silicon, no libusb, etc). Rolling our
 * own keeps the backend portable — we only need the subset of ESC/POS
 * used by KOT and bill printing.
 *
 * We produce a Buffer the `PrinterTransport` then ships to the real
 * hardware (network socket, USB, or file for dev).
 */

const ESC = 0x1b;
const GS = 0x1d;

const ALIGN = { LEFT: 0, CENTER: 1, RIGHT: 2 };
const SIZE = { NORMAL: 0x00, DOUBLE_HEIGHT: 0x01, DOUBLE_WIDTH: 0x10, DOUBLE: 0x11 };

class EscPosBuilder {
  constructor({ width = 48 } = {}) {
    this.width = width;
    this.buf = [];
    this.init();
  }

  _push(bytes) {
    this.buf.push(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
    return this;
  }

  init() {
    return this._push([ESC, 0x40]);
  }

  align(type) {
    const v = ALIGN[type] ?? ALIGN.LEFT;
    return this._push([ESC, 0x61, v]);
  }

  bold(on = true) {
    return this._push([ESC, 0x45, on ? 1 : 0]);
  }

  underline(on = true) {
    return this._push([ESC, 0x2d, on ? 1 : 0]);
  }

  size(mode = SIZE.NORMAL) {
    return this._push([GS, 0x21, mode]);
  }

  text(str) {
    return this._push(Buffer.from(String(str ?? ''), 'utf8'));
  }

  line(str = '') {
    this.text(str);
    return this._push(Buffer.from([0x0a]));
  }

  rule(char = '-') {
    return this.line(char.repeat(this.width));
  }

  feed(n = 1) {
    return this._push(Buffer.from([ESC, 0x64, n]));
  }

  cut() {
    return this._push([GS, 0x56, 0x41, 0x03]);
  }

  beep(times = 1, duration = 2) {
    return this._push([ESC, 0x42, times, duration]);
  }

  /** Two-column line with a left label and right value, padded to width. */
  kv(left, right) {
    const l = String(left);
    const r = String(right);
    const spaces = Math.max(1, this.width - l.length - r.length);
    return this.line(`${l}${' '.repeat(spaces)}${r}`);
  }

  /** Wrap long text, indenting continuation lines. */
  wrap(str, { indent = 0 } = {}) {
    const words = String(str).split(/\s+/);
    const max = this.width - indent;
    let line = '';
    const pad = ' '.repeat(indent);
    for (const w of words) {
      if (!line.length) {
        line = w;
        continue;
      }
      if (line.length + 1 + w.length <= max) {
        line += ` ${w}`;
      } else {
        this.line(`${pad}${line}`);
        line = w;
      }
    }
    if (line.length) this.line(`${pad}${line}`);
    return this;
  }

  build() {
    return Buffer.concat(this.buf);
  }
}

EscPosBuilder.ALIGN = ALIGN;
EscPosBuilder.SIZE = SIZE;

module.exports = EscPosBuilder;
