import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { BaseRepository } from './BaseRepository.js';

export class NdjsonRepository extends BaseRepository {
  async findAll() {
    if (!existsSync(this.filePath)) return [];
    const content = await fs.readFile(this.filePath, 'utf-8');
    return content.trim().split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));
  }

  async create(data) {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    const line = JSON.stringify(data) + '\n';
    await fs.appendFile(this.filePath, line, 'utf-8');
    return data;
  }
}
