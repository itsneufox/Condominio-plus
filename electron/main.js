const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let mainWindow = null;
let db = null;
let dbPath = null;
const WINDOW_STATE_CHANNEL = 'window:state';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    resizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    thickFrame: true,
    trafficLightPosition: { x: 16, y: 16 },
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setResizable(true);
  mainWindow.setMinimizable(true);
  mainWindow.setMaximizable(true);
  mainWindow.setFullScreenable(true);

  Menu.setApplicationMenu(null);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
  }

  const sendWindowState = () => {
    if (!mainWindow) return;
    const state = mainWindow.isMaximized() ? 'maximized' : 'normal';
    mainWindow.webContents.send(WINDOW_STATE_CHANNEL, state);
  };

  mainWindow.on('ready-to-show', sendWindowState);
  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) {
    return 'normal';
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }

  return mainWindow.isMaximized() ? 'maximized' : 'normal';
});

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window:get-state', () => {
  if (!mainWindow) {
    return 'normal';
  }
  return mainWindow.isMaximized() ? 'maximized' : 'normal';
});

async function initDatabase() {
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'condo-manager.db');

  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, '../node_modules/sql.js/dist', file)
  });

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const schema = `
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      administrator_name TEXT DEFAULT 'Administrador',
      company_name TEXT DEFAULT 'Condomínio+',
      contact_email TEXT,
      contact_phone TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS condominiums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      nipc TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      unit_number TEXT NOT NULL,
      unit_type TEXT DEFAULT 'apartment' CHECK(unit_type IN ('apartment', 'store', 'garage', 'other')),
      floor TEXT,
      permilagem REAL DEFAULT 1.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      nif TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
    );

    CREATE TABLE IF NOT EXISTS unit_ownership (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      person_id INTEGER NOT NULL,
      relationship_type TEXT NOT NULL CHECK(relationship_type IN ('owner', 'renter', 'usufructuary', 'proxy')),
      start_date DATE NOT NULL,
      end_date DATE,
      is_active BOOLEAN DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (person_id) REFERENCES people(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      reserve_fund_amount REAL DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      planned_amount REAL NOT NULL,
      description TEXT,
      allocation_scope TEXT DEFAULT 'all' CHECK(allocation_scope IN ('all', 'unit_types', 'custom')),
      eligible_unit_types TEXT,
      FOREIGN KEY (budget_id) REFERENCES budgets(id)
    );

    CREATE TABLE IF NOT EXISTS budget_category_units (
      category_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      PRIMARY KEY (category_id, unit_id),
      FOREIGN KEY (category_id) REFERENCES budget_categories(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      nif TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
    );

    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      unit_id INTEGER,
      supplier_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      reported_date DATE NOT NULL,
      due_date DATE,
      completed_date DATE,
      estimated_cost REAL,
      actual_cost REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id),
      FOREIGN KEY (unit_id) REFERENCES units(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      meeting_date DATE NOT NULL,
      location TEXT,
      agenda TEXT,
      minutes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
    );

    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      audience TEXT DEFAULT 'all',
      channel TEXT DEFAULT 'noticeboard',
      status TEXT DEFAULT 'draft',
      sent_date DATE,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condominium_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT,
      category_id INTEGER,
      supplier_id INTEGER,
      amount REAL NOT NULL,
      description TEXT,
      transaction_date DATE NOT NULL,
      is_reserve_fund BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (condominium_id) REFERENCES condominiums(id),
      FOREIGN KEY (category_id) REFERENCES budget_categories(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      due_date DATE,
      period TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue')),
      paid_at DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS quota_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'finalized')),
      notes TEXT,
      FOREIGN KEY (budget_id) REFERENCES budgets(id)
    );

    CREATE TABLE IF NOT EXISTS quota_schedule_items (
      schedule_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      month_index INTEGER NOT NULL,
      amount REAL NOT NULL,
      PRIMARY KEY (schedule_id, unit_id, month_index),
      FOREIGN KEY (schedule_id) REFERENCES quota_schedules(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    );
  `;

  db.run(schema);

  const settingsExists = db.exec('SELECT 1 FROM app_settings WHERE id = 1');
  if (!settingsExists.length) {
    db.run(
      'INSERT INTO app_settings (id, administrator_name, company_name) VALUES (1, ?, ?)',
      ['Administrador', 'Condomínio+']
    );
  }

  // Ensure legacy databases gain newer schema columns
  const ensureColumn = (table, column, definition, postAddSql) => {
    const result = db.exec(`PRAGMA table_info(${table});`);
    const hasColumn =
      Array.isArray(result) &&
      result.length > 0 &&
      Array.isArray(result[0].values) &&
      result[0].values.some((row) => row[1] === column);

    if (!hasColumn) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      if (postAddSql) {
        db.run(postAddSql);
      }
    }
  };

  ensureColumn(
    'units',
    'permilagem',
    'REAL DEFAULT 1.0',
    'UPDATE units SET permilagem = 1.0 WHERE permilagem IS NULL'
  );
  ensureColumn(
    'units',
    'unit_type',
    "TEXT DEFAULT 'apartment'",
    "UPDATE units SET unit_type = 'apartment' WHERE unit_type IS NULL OR unit_type = ''"
  );
  ensureColumn('units', 'floor', 'TEXT', null);
  ensureColumn('units', 'notes', 'TEXT', null);
  ensureColumn(
    'units',
    'created_at',
    'DATETIME DEFAULT CURRENT_TIMESTAMP',
    'UPDATE units SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL'
  );
  ensureColumn(
    'budget_categories',
    'category_type',
    "TEXT DEFAULT 'general'",
    "UPDATE budget_categories SET category_type = 'general' WHERE category_type IS NULL OR category_type = ''"
  );
  ensureColumn(
    'budget_categories',
    'allocation_scope',
    "TEXT DEFAULT 'all'",
    "UPDATE budget_categories SET allocation_scope = 'all' WHERE allocation_scope IS NULL OR allocation_scope = ''"
  );
  ensureColumn('budget_categories', 'eligible_unit_types', 'TEXT', null);
  ensureColumn('transactions', 'category_id', 'INTEGER', null);
  ensureColumn('transactions', 'supplier_id', 'INTEGER', null);
  ensureColumn('payments', 'due_date', 'DATE', null);
  ensureColumn('payments', 'paid_at', 'DATE', null);
  ensureColumn('payments', 'notes', 'TEXT', null);

  // Support for standalone quota schedules
  ensureColumn('quota_schedules', 'condominium_id', 'INTEGER', null);
  ensureColumn('quota_schedules', 'is_standalone', 'INTEGER DEFAULT 0', null);
  ensureColumn('quota_schedules', 'total_amount', 'REAL', null);
  ensureColumn('quota_schedules', 'duration_months', 'INTEGER', null);
  ensureColumn('quota_schedules', 'title', 'TEXT', null);

  // Support for reserve fund percentage in budgets
  ensureColumn('budgets', 'reserve_fund_percentage', 'REAL DEFAULT 10.0', null);

  // Support for FCR contribution flag in budget categories
  ensureColumn('budget_categories', 'contributes_to_fcr', 'INTEGER DEFAULT 1', null);

  const unitOwnershipTable = db.exec(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='unit_ownership'"
  );
  const needsUnitOwnershipMigration =
    Array.isArray(unitOwnershipTable) &&
    unitOwnershipTable.length > 0 &&
    unitOwnershipTable[0].values &&
    unitOwnershipTable[0].values.length > 0 &&
    typeof unitOwnershipTable[0].values[0][0] === 'string' &&
    (!unitOwnershipTable[0].values[0][0].includes("'usufructuary'") ||
      !unitOwnershipTable[0].values[0][0].includes("'proxy'"));

  if (needsUnitOwnershipMigration) {
    db.run('BEGIN TRANSACTION');
    db.run(`
      CREATE TABLE unit_ownership_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id INTEGER NOT NULL,
        person_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL CHECK(relationship_type IN ('owner', 'renter', 'usufructuary', 'proxy')),
        start_date DATE NOT NULL,
        end_date DATE,
        is_active BOOLEAN DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_id) REFERENCES units(id),
        FOREIGN KEY (person_id) REFERENCES people(id)
      )
    `);
    db.run(`
      INSERT INTO unit_ownership_new (id, unit_id, person_id, relationship_type, start_date, end_date, is_active, notes, created_at)
      SELECT id, unit_id, person_id, relationship_type, start_date, end_date, is_active, notes, created_at
      FROM unit_ownership
    `);
    db.run('DROP TABLE unit_ownership');
    db.run('ALTER TABLE unit_ownership_new RENAME TO unit_ownership');
    db.run('COMMIT');
  }

  saveDatabase();
}

function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) {
    saveDatabase();
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for database operations
ipcMain.handle('db:query', async (_, sql, params = []) => {
  try {
    console.log('db:query', sql, params);
    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    console.log('db:query results:', results);
    return { success: true, data: results };
  } catch (error) {
    console.error('db:query error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:run', async (_, sql, params = []) => {
  try {
    console.log('db:run', sql, params);
    db.run(sql, params);
    saveDatabase();

    // Get last insert ID
    let lastID = null;
    try {
      const result = db.exec("SELECT last_insert_rowid() as id");
      if (result && result[0] && result[0].values && result[0].values[0]) {
        lastID = result[0].values[0][0];
      }
    } catch (e) {
      console.log('Could not get last insert ID:', e);
    }

    console.log('db:run success, lastID:', lastID);
    return {
      success: true,
      data: {
        lastID: lastID,
        changes: 1
      }
    };
  } catch (error) {
    console.error('db:run error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get', async (_, sql, params = []) => {
  try {
    console.log('db:get', sql, params);
    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    console.log('db:get result:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('db:get error:', error);
    return { success: false, error: error.message };
  }
});
