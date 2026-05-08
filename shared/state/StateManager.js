export class StateManager {
  constructor() {
    this.state = {
      scheduler: 'idle',
      metrics: {}
    };
  }

  getState(key) {
    return this.state[key];
  }

  setState(key, value) {
    this.state[key] = value;
  }

  updateState(key, value) {
    if (typeof value === 'object' && !Array.isArray(value)) {
      this.state[key] = { ...this.state[key], ...value };
    } else {
      this.state[key] = value;
    }
  }
}

// Export a singleton instance for global access
export const stateManager = new StateManager();
