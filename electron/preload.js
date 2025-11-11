const { contextBridge, ipcRenderer } = require('electron');

const WINDOW_STATE_CHANNEL = 'window:state';

const windowControls = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  getState: () => ipcRenderer.invoke('window:get-state'),
  onStateChange: callback => {
    const subscription = (_event, state) => callback(state);
    ipcRenderer.on(WINDOW_STATE_CHANNEL, subscription);
    return () => {
      ipcRenderer.removeListener(WINDOW_STATE_CHANNEL, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', {
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
  windowControls,
});
