export class BaseRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }
  async findAll() { throw new Error('Not implemented'); }
  async create(data) { throw new Error('Not implemented'); }
  async update(data) { throw new Error('Not implemented'); }
}
