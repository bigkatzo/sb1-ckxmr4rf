import { logger } from './logger';
import pako from 'pako';

export class PayloadCompressor {
  private static instance: PayloadCompressor;
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB

  private constructor() {}

  static getInstance(): PayloadCompressor {
    if (!PayloadCompressor.instance) {
      PayloadCompressor.instance = new PayloadCompressor();
    }
    return PayloadCompressor.instance;
  }

  public shouldCompress(data: any): boolean {
    const size = new TextEncoder().encode(JSON.stringify(data)).length;
    return size > this.COMPRESSION_THRESHOLD;
  }

  public compress(data: any): Uint8Array {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = pako.deflate(jsonString);
      logger.debug('Compressed payload', {
        context: {
          originalSize: jsonString.length,
          compressedSize: compressed.length,
          ratio: (compressed.length / jsonString.length * 100).toFixed(2) + '%'
        }
      });
      return compressed;
    } catch (error) {
      logger.error('Compression failed', { context: { error } });
      throw error;
    }
  }

  public decompress(data: Uint8Array): any {
    try {
      const decompressed = pako.inflate(data, { to: 'string' });
      return JSON.parse(decompressed);
    } catch (error) {
      logger.error('Decompression failed', { context: { error } });
      throw error;
    }
  }

  public async compressAsync(data: any): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      try {
        resolve(this.compress(data));
      } catch (error) {
        reject(error);
      }
    });
  }

  public async decompressAsync(data: Uint8Array): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        resolve(this.decompress(data));
      } catch (error) {
        reject(error);
      }
    });
  }
} 