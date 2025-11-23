window.AdminApi = {
  endpoint: 'https://script.google.com/macros/s/AKfycbwsqkjmGtQwnDUsfeBrR1kTtCdlY0mbEqETNkBPfrBD7N0qFwbKXQjjNynpltmsxUoA/exec',

  async listVehicles() {
    return this._request('GET', { action: 'list' });
  },

  async createVehicle(data) {
    return this._request('POST', { action: 'create', payload: data });
  },

  async updateVehicle(rowId, data) {
    return this._request('PUT', { action: 'update', rowId, payload: data });
  },

  async deleteVehicle(rowId) {
    return this._request('DELETE', { action: 'delete', rowId });
  },

  async _request(method, payload) {
    let url = this.endpoint;

    if (method === 'GET') {
      const params = new URLSearchParams(payload);
      url += `?${params.toString()}`;
    } 

    console.log('method', method);
    if (method === 'POST')
    {
     const params = new URLSearchParams(payload);
    url += `?${params.toString()}`;

    }

    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.success === false) throw new Error(json.message || 'API lỗi');
    return json;
  }
};
