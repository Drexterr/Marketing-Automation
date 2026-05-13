import { RuntimeStateRepository } from '../repositories/RuntimeStateRepository.js';

export class StateManager {
  constructor() {
    this.repo = new RuntimeStateRepository();
    
    // Initialize default state if not present
    if (this.repo.get('scheduler') === null) {
      this.repo.set('scheduler', 'idle');
    }
    if (this.repo.get('metrics') === null) {
      this.repo.set('metrics', {});
    }
  }

  getState(key) {
    return this.repo.get(key);
  }

  setState(key, value) {
    this.repo.set(key, value);
  }

  updateState(key, value) {
    const current = this.repo.get(key);
    if (typeof value === 'object' && !Array.isArray(value) && typeof current === 'object' && current !== null) {
      this.repo.set(key, { ...current, ...value });
    } else {
      this.repo.set(key, value);
    }
  }
}

// Export a singleton instance for global access
export const stateManager = new StateManager();
