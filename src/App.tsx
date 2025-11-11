import { useState, useEffect, useMemo } from 'react';
import {
  Building,
  DollarSign,
  FileText,
  Users,
  Home,
  User,
  CreditCard,
  Factory,
  Wrench,
  CalendarDays,
  Megaphone,
  CalendarRange,
  Moon,
  Sun,
  Minus,
  Square,
  Copy,
  X,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Condominium, WindowState, AppSettings } from './types';
import CondominiumList from './components/CondominiumList';
import Dashboard from './components/Dashboard';
import BudgetManager from './components/BudgetManager';
import TransactionManager from './components/TransactionManager';
import UnitManager from './components/UnitManager';
import PeopleManager from './components/PeopleManager';
import PaymentManager from './components/PaymentManager';
import SupplierManager from './components/SupplierManager';
import MaintenanceManager from './components/MaintenanceManager';
import MeetingsManager from './components/MeetingsManager';
import CommunicationsManager from './components/CommunicationsManager';
import QuotaSchedule from './components/QuotaSchedule';
import SettingsView from './components/SettingsView';
import './App.css';

type View =
  | 'welcome'
  | 'dashboard'
  | 'budget'
  | 'transactions'
  | 'units'
  | 'people'
  | 'payments'
  | 'quotaSchedule'
  | 'suppliers'
  | 'maintenance'
  | 'meetings'
  | 'communications'
  | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [selectedCondo, setSelectedCondo] = useState<Condominium | null>(null);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [windowState, setWindowState] = useState<WindowState>('normal');
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const viewTitles: Record<View, string> = useMemo(() => ({
    welcome: 'Condomínios',
    dashboard: 'Painel',
    budget: 'Orçamento',
    transactions: 'Movimentos',
    units: 'Frações',
    people: 'Pessoas',
    payments: 'Quotas',
    quotaSchedule: 'Plano de Quotas',
    suppliers: 'Fornecedores',
    maintenance: 'Manutenção',
    meetings: 'Reuniões',
    communications: 'Comunicações',
    settings: 'Configurações',
  }), []);

  useEffect(() => {
    loadCondominiums();
    loadAppSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const controls = window.electronAPI.windowControls;
    controls
      .getState()
      .then(setWindowState)
      .catch(() => {});

    const unsubscribe = controls.onStateChange(setWindowState);
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadCondominiums = async () => {
    const result = await window.electronAPI.query('SELECT * FROM condominiums ORDER BY name');
    if (result.success) {
      setCondominiums(result.data || []);
      if (result.data && result.data.length > 0 && !selectedCondo) {
        setSelectedCondo(result.data[0]);
      }
    }
  };

  const loadAppSettings = async () => {
    const result = await window.electronAPI.get(
      `SELECT administrator_name, company_name, contact_email, contact_phone FROM app_settings WHERE id = 1`
    );

    if (result.success) {
      setAppSettings(result.data || null);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const administratorName = appSettings?.administrator_name?.trim() || 'Administrador';
  const companyName = appSettings?.company_name?.trim() || 'Condomínio+';

  const handleCondoSelect = (condo: Condominium) => {
    setSelectedCondo(condo);
    setCurrentView('dashboard');
  };

  const handleMinimize = () => {
    window.electronAPI.windowControls.minimize();
  };

  const handleToggleMaximize = () => {
    window.electronAPI.windowControls
      .toggleMaximize()
      .then(setWindowState)
      .catch(() => {});
  };

  const handleClose = () => {
    window.electronAPI.windowControls.close();
  };

  const activeViewTitle = viewTitles[currentView];
  const titleBarTitle = (() => {
    if (!selectedCondo) {
      return currentView === 'welcome' ? companyName : activeViewTitle;
    }

    if (currentView === 'welcome') {
      return companyName;
    }

    if (currentView === 'settings') {
      return activeViewTitle;
    }

    return selectedCondo.name;
  })();
  const showCondoContext = Boolean(
    selectedCondo && currentView !== 'welcome' && currentView !== 'settings'
  );

  const appClassName = windowState === 'maximized' ? 'app app-maximized' : 'app';

  return (
    <div className={appClassName}>
      <div className="title-bar">
        <div className="title-bar-drag-region"></div>
        <div className="title-bar-title">{titleBarTitle}</div>
        <div className="title-bar-actions">
          <button
            className="theme-toggle-titlebar"
            onClick={toggleDarkMode}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="window-controls">
            <button className="window-button" onClick={handleMinimize} title="Minimize">
              <Minus size={12} strokeWidth={2} />
            </button>
            <button
              className="window-button"
              onClick={handleToggleMaximize}
              title={windowState === 'maximized' ? 'Restore' : 'Maximize'}
            >
              {windowState === 'maximized' ? <Copy size={12} strokeWidth={2} /> : <Square size={12} strokeWidth={2} />}
            </button>
            <button className="window-button window-button-close" onClick={handleClose} title="Close">
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
      <div className="app-content">
        <aside className="sidebar">
          <div className="sidebar-header">
            <Building size={32} />
            <div className="sidebar-brand">
              <h1>{administratorName}</h1>
              <span>{companyName}</span>
            </div>
          </div>

          <nav className="nav">
            <div className="nav-main">
              <button
                className={currentView === 'welcome' ? 'active' : ''}
                onClick={() => setCurrentView('welcome')}
              >
                <Home size={20} />
                <span>Condomínios</span>
              </button>
              {selectedCondo && (
                <>
                  <button
                    className={currentView === 'dashboard' ? 'active' : ''}
                    onClick={() => setCurrentView('dashboard')}
                  >
                    <FileText size={20} />
                    <span>Painel</span>
                  </button>
                  <button
                    className={currentView === 'budget' ? 'active' : ''}
                    onClick={() => setCurrentView('budget')}
                  >
                    <DollarSign size={20} />
                    <span>Orçamento</span>
                  </button>
                  <button
                    className={currentView === 'transactions' ? 'active' : ''}
                    onClick={() => setCurrentView('transactions')}
                  >
                    <FileText size={20} />
                    <span>Movimentos</span>
                  </button>
                  <button
                    className={currentView === 'people' ? 'active' : ''}
                    onClick={() => setCurrentView('people')}
                  >
                    <User size={20} />
                    <span>Pessoas</span>
                  </button>
                  <button
                    className={currentView === 'payments' ? 'active' : ''}
                    onClick={() => setCurrentView('payments')}
                  >
                    <CreditCard size={20} />
                    <span>Quotas</span>
                  </button>
                  <button
                    className={currentView === 'units' ? 'active' : ''}
                    onClick={() => setCurrentView('units')}
                  >
                    <Users size={20} />
                    <span>Frações</span>
                  </button>
                  <button
                    className={currentView === 'suppliers' ? 'active' : ''}
                    onClick={() => setCurrentView('suppliers')}
                  >
                    <Factory size={20} />
                    <span>Fornecedores</span>
                  </button>
                  <button
                    className={currentView === 'maintenance' ? 'active' : ''}
                    onClick={() => setCurrentView('maintenance')}
                  >
                    <Wrench size={20} />
                    <span>Manutenção</span>
                  </button>
                  <button
                    className={currentView === 'meetings' ? 'active' : ''}
                    onClick={() => setCurrentView('meetings')}
                  >
                    <CalendarDays size={20} />
                    <span>Reuniões</span>
                  </button>
                  <button
                    className={currentView === 'communications' ? 'active' : ''}
                    onClick={() => setCurrentView('communications')}
                  >
                    <Megaphone size={20} />
                    <span>Comunicações</span>
                  </button>
                  <button
                    className={currentView === 'quotaSchedule' ? 'active' : ''}
                    onClick={() => setCurrentView('quotaSchedule')}
                  >
                    <CalendarRange size={20} />
                    <span>Plano de Quotas</span>
                  </button>
                </>
              )}
            </div>
            <div className="nav-footer">
              <button
                className={currentView === 'settings' ? 'active' : ''}
                onClick={() => setCurrentView('settings')}
              >
                <SettingsIcon size={20} />
                <span>Configurações</span>
              </button>
            </div>
          </nav>
        </aside>

        <main className="main-content">
          <div className="content-wrapper">
            {showCondoContext && selectedCondo && (
              <div className="context-bar">
                <span className="context-label">{activeViewTitle}</span>
                <span className="context-chip">{selectedCondo.name}</span>
              </div>
            )}

            {currentView === 'welcome' && (
              <CondominiumList
                condominiums={condominiums}
                onSelect={handleCondoSelect}
                onUpdate={loadCondominiums}
              />
            )}

            {currentView === 'dashboard' && selectedCondo && (
              <Dashboard condominium={selectedCondo} />
            )}

            {currentView === 'budget' && selectedCondo && (
              <BudgetManager
                condominium={selectedCondo}
                onOpenQuotaSchedule={() => setCurrentView('quotaSchedule')}
              />
            )}

            {currentView === 'transactions' && selectedCondo && (
              <TransactionManager condominium={selectedCondo} />
            )}

            {currentView === 'people' && selectedCondo && (
              <PeopleManager condominium={selectedCondo} />
            )}

            {currentView === 'payments' && selectedCondo && (
              <PaymentManager condominium={selectedCondo} />
            )}

            {currentView === 'quotaSchedule' && selectedCondo && (
              <QuotaSchedule condominium={selectedCondo} />
            )}

            {currentView === 'units' && selectedCondo && (
              <UnitManager condominium={selectedCondo} />
            )}

            {currentView === 'suppliers' && selectedCondo && (
              <SupplierManager condominium={selectedCondo} />
            )}

            {currentView === 'maintenance' && selectedCondo && (
              <MaintenanceManager condominium={selectedCondo} />
            )}

            {currentView === 'meetings' && selectedCondo && (
              <MeetingsManager condominium={selectedCondo} />
            )}

            {currentView === 'communications' && selectedCondo && (
              <CommunicationsManager condominium={selectedCondo} />
            )}

            {currentView === 'settings' && (
              <SettingsView settings={appSettings} onUpdated={loadAppSettings} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
