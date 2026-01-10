window.AdminApi = {
  endpoint: 'https://script.google.com/macros/s/AKfycbxVWWuvr4UZsv1CXNp-GjTxrRRjs5N23akTcsILhOZ1A-dQlHycmkbpr6uqlsIcTbe8/exec',

  async listVehicles() {
    return this._request({ action: 'list' });
  },

  async createVehicle(data) {
    return this._request({ action: 'create', payload: data });
  },

  async updateVehicle(rowId, data) {
    return this._request({ action: 'update', rowId, payload: data });
  },

  async deleteVehicle(rowId) {
    return this._request({ action: 'delete', rowId });
  },

  async _request(payload) {
    const params = new URLSearchParams();
    const data = payload || {};
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (value === undefined || value === null) return;
      if (key === 'payload') {
        params.set('payload', typeof value === 'string' ? value : JSON.stringify(value));
        return;
      }
      params.set(key, String(value));
    });
    params.set('_ts', Date.now().toString());

    const url = `${this.endpoint}?${params.toString()}`;

    const res = await fetch(url);
    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error('API trả về dữ liệu không hợp lệ.');
    }
    if (!res.ok || json.success === false) throw new Error(json.message || 'API lỗi');
    return json;
  }
};
