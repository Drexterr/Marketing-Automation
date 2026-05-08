import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { BaseRepository } from './BaseRepository.js';

export class JsonRepository extends BaseRepository {
  async findAll() {
    if (!existsSync(this.filePath)) return {};
    const content = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(content || '{}');
  }

  async update(data) {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    const current = await this.findAll();
    const updated = { ...current, ...data };
    await fs.writeFile(this.filePath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  async create(data) {
    return this.update(data); // For JSON config, create is just update/overwrite
  }
}
