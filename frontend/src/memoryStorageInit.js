export const memoryStorage = {
  _data: {},
  setItem(id, val) { this._data[id] = String(val); },
  getItem(id) { return this._data.hasOwnProperty(id) ? this._data[id] : null; },
  removeItem(id) { delete this._data[id]; },
  clear() { this._data = {}; }
};
window.memoryStorage = memoryStorage;
