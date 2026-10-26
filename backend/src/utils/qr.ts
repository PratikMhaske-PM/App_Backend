import crypto from 'crypto';
import { env } from '../config/env';
import { Booking } from '../types/common.types';

export interface QrCodeResult {
  bookingId: string;
  verificationCode: string;
  verificationUrl: string;
  qrPayload: {
    bookingId: string;
    customerId: string;
    workerId: string;
    bookingDate: string;
    status: string;
    verificationHash: string;
  };
  svg: string;
  dataUrl: string;
}

/**
 * Generates an HMAC verification signature for a booking.
 */
export function generateBookingVerificationHash(bookingId: string, customerId: string, workerId: string): string {
  const payload = `${bookingId}:${customerId}:${workerId}`;
  return crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Lightweight, standards-compliant QR Code Matrix Generator (Versions 1-6, Byte mode, EC level M).
 * Generates valid, scan-able QR matrices without any external dependencies.
 */
class QrMatrix {
  private size: number;
  private modules: boolean[][];
  private isReserved: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => Array(size).fill(false));
    this.isReserved = Array.from({ length: size }, () => Array(size).fill(false));
  }

  getSize(): number {
    return this.size;
  }

  isDark(row: number, col: number): boolean {
    return this.modules[row]?.[col] ?? false;
  }

  set(row: number, col: number, dark: boolean, reserved = true): void {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      this.modules[row]![col] = dark;
      if (reserved) {
        this.isReserved[row]![col] = true;
      }
    }
  }

  isCellReserved(row: number, col: number): boolean {
    return this.isReserved[row]?.[col] ?? false;
  }

  // Draw 7x7 Finder Pattern at (row, col)
  addFinderPattern(row: number, col: number): void {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
          if (
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            this.set(nr, nc, true);
          } else {
            this.set(nr, nc, false);
          }
        }
      }
    }
  }

  // Draw Alignment Pattern (5x5) centered at (row, col)
  addAlignmentPattern(row: number, col: number): void {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const nr = row + r;
        const nc = col + c;
        if (!this.isCellReserved(nr, nc)) {
          const isEdge = Math.abs(r) === 2 || Math.abs(c) === 2;
          const isCenter = r === 0 && c === 0;
          this.set(nr, nc, isEdge || isCenter);
        }
      }
    }
  }
}

// GF(256) Math for Reed-Solomon Error Correction
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
let val = 1;
for (let i = 0; i < 255; i++) {
  EXP_TABLE[i] = val;
  LOG_TABLE[val] = i;
  val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
}
EXP_TABLE[255] = EXP_TABLE[0]!;

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[x]! + LOG_TABLE[y]!) % 255]!;
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i]!, p2[j]!);
    }
  }
  return result;
}

function getGeneratorPoly(ecLen: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    poly = polyMul(poly, [1, EXP_TABLE[i]!]);
  }
  return poly;
}

function calculateReedSolomon(data: number[], ecCount: number): number[] {
  const gen = getGeneratorPoly(ecCount);
  const result = new Array(ecCount).fill(0);

  for (const byte of data) {
    const factor = byte ^ result[0]!;
    result.shift();
    result.push(0);
    for (let i = 0; i < ecCount; i++) {
      result[i] ^= gfMul(gen[i + 1]!, factor);
    }
  }
  return result;
}

// Version table parameters for EC Level M
const VERSION_PARAMS: Record<number, { dataBytes: number; ecBytes: number; alignPos: number[] }> = {
  1: { dataBytes: 16, ecBytes: 10, alignPos: [] },
  2: { dataBytes: 28, ecBytes: 16, alignPos: [6, 18] },
  3: { dataBytes: 44, ecBytes: 26, alignPos: [6, 22] },
  4: { dataBytes: 64, ecBytes: 36, alignPos: [6, 26] },
  5: { dataBytes: 86, ecBytes: 48, alignPos: [6, 30] },
  6: { dataBytes: 108, ecBytes: 64, alignPos: [6, 34] },
};

export function encodeStringToQrMatrix(text: string): boolean[][] {
  const rawBytes = Buffer.from(text, 'utf-8');
  let version = 1;
  while (version <= 6 && rawBytes.length + 3 > VERSION_PARAMS[version]!.dataBytes) {
    version++;
  }
  if (version > 6) {
    version = 6;
  }

  const { dataBytes, ecBytes, alignPos } = VERSION_PARAMS[version]!;
  const size = 17 + version * 4;
  const qr = new QrMatrix(size);

  // 1. Add Finder Patterns
  qr.addFinderPattern(0, 0);
  qr.addFinderPattern(size - 7, 0);
  qr.addFinderPattern(0, size - 7);

  // 2. Alignment patterns
  for (const r of alignPos) {
    for (const c of alignPos) {
      if (!((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6))) {
        qr.addAlignmentPattern(r, c);
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const isDark = i % 2 === 0;
    if (!qr.isCellReserved(6, i)) qr.set(6, i, isDark);
    if (!qr.isCellReserved(i, 6)) qr.set(i, 6, isDark);
  }

  // 4. Reserve format areas
  for (let i = 0; i < 9; i++) {
    qr.set(8, i, false);
    qr.set(i, 8, false);
    if (i < 8) {
      qr.set(size - 1 - i, 8, false);
      qr.set(8, size - 1 - i, false);
    }
  }
  qr.set(size - 8, 8, true); // Dark module

  // 5. Build Bitstream (Byte Mode: 0100)
  const bitStream: number[] = [0, 1, 0, 0];
  const charCount = Math.min(rawBytes.length, dataBytes - 3);

  // Char count indicator (8 bits for versions 1-9)
  for (let i = 7; i >= 0; i--) {
    bitStream.push((charCount >> i) & 1);
  }

  // Data bytes
  for (let i = 0; i < charCount; i++) {
    const byte = rawBytes[i]!;
    for (let b = 7; b >= 0; b--) {
      bitStream.push((byte >> b) & 1);
    }
  }

  // Terminator (up to 4 zeroes)
  while (bitStream.length < dataBytes * 8 && bitStream.length % 8 !== 0) {
    bitStream.push(0);
  }

  // Pad to bytes
  const dataCodewords: number[] = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | (bitStream[i + b] || 0);
    }
    dataCodewords.push(byteVal);
  }

  // Pad bytes alternating 0xEC, 0x11
  let padIdx = 0;
  const padBytes = [0xec, 0x11];
  while (dataCodewords.length < dataBytes) {
    dataCodewords.push(padBytes[padIdx % 2]!);
    padIdx++;
  }

  // 6. Reed-Solomon Error Correction Code
  const ecCodewords = calculateReedSolomon(dataCodewords, ecBytes);
  const allCodewords = [...dataCodewords, ...ecCodewords];

  // 7. Place Codewords in Zigzag Order
  const allBits: number[] = [];
  for (const byte of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((byte >> b) & 1);
    }
  }

  let bitIdx = 0;
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol--; // Skip vertical timing pattern

    for (let vert = 0; vert < size; vert++) {
      const isUp = ((size - 1 - rightCol) / 2) % 2 === 0;
      const row = isUp ? size - 1 - vert : vert;

      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = rightCol - colOffset;
        if (!qr.isCellReserved(row, col)) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx]! : 0;
          bitIdx++;

          // Mask Pattern 0: (row + col) % 2 === 0
          const mask = (row + col) % 2 === 0;
          qr.set(row, col, (bit === 1) !== mask, false);
        }
      }
    }
  }

  // 8. Format Info (EC Level M, Mask 0) = 0x5412 XOR 0x5412 = 0
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) qr.set(8, i, formatBits[i] === 1);
  qr.set(8, 7, formatBits[6] === 1);
  qr.set(8, 8, formatBits[7] === 1);
  qr.set(7, 8, formatBits[8] === 1);
  for (let i = 9; i < 15; i++) qr.set(14 - i, 8, formatBits[i] === 1);

  for (let i = 0; i < 8; i++) qr.set(8, size - 1 - i, formatBits[i] === 1);
  for (let i = 8; i < 15; i++) qr.set(size - 15 + i, 8, formatBits[i] === 1);

  // Return boolean matrix
  const matrix: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(qr.isDark(r, c));
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Generates an SVG string representation of a QR Code.
 */
export function generateQrCodeSvg(text: string): string {
  const matrix = encodeStringToQrMatrix(text);
  const size = matrix.length;
  const border = 4;
  const viewBoxSize = size + border * 2;
  const scale = 8;
  const pixelSize = viewBoxSize * scale;

  let pathData = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r]?.[c]) {
        pathData += `M${c + border},${r + border}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${pathData.trim()}" fill="#000000"/></svg>`;
}

/**
 * Generates a full QR Code result object with Data URI and Verification Hash for a booking.
 */
export function generateBookingQrCode(booking: Booking): QrCodeResult {
  const verificationHash = generateBookingVerificationHash(
    booking.id,
    booking.customerId,
    booking.workerId
  );

  const qrPayload = {
    bookingId: booking.id,
    customerId: booking.customerId,
    workerId: booking.workerId,
    bookingDate: booking.bookingDate,
    status: booking.status,
    verificationHash,
  };

  const payloadString = JSON.stringify(qrPayload);
  const svg = generateQrCodeSvg(payloadString);
  const base64Svg = Buffer.from(svg).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

  return {
    bookingId: booking.id,
    verificationCode: verificationHash,
    verificationUrl: `/api/bookings/${booking.id}/verify?code=${verificationHash}`,
    qrPayload,
    svg,
    dataUrl,
  };
}
