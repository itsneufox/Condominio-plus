import { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings | null;
  onUpdated: () => void;
}

const initialState: AppSettings = {
  administrator_name: '',
  company_name: '',
  contact_email: '',
  contact_phone: '',
};

export default function SettingsView({ settings, onUpdated }: Props) {
  const [formData, setFormData] = useState<AppSettings>(initialState);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setFormData({
      administrator_name: settings?.administrator_name ?? '',
      company_name: settings?.company_name ?? '',
      contact_email: settings?.contact_email ?? '',
      contact_phone: settings?.contact_phone ?? '',
    });
  }, [settings]);

  const handleChange = (field: keyof AppSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      await window.electronAPI.run(
        `
          UPDATE app_settings
          SET administrator_name = ?, company_name = ?, contact_email = ?, contact_phone = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `,
        [
          formData.administrator_name?.trim() || null,
          formData.company_name?.trim() || null,
          formData.contact_email?.trim() || null,
          formData.contact_phone?.trim() || null,
        ]
      );

      setStatus({ type: 'success', message: 'Informações atualizadas com sucesso.' });
      onUpdated();
    } catch (error) {
      setStatus({ type: 'error', message: 'Não foi possível atualizar as informações. Tente novamente.' });
      console.error('Failed to update app settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setStatus(null);

    try {
      await window.electronAPI.run(
        `
          UPDATE app_settings
          SET administrator_name = 'Administrador', company_name = 'Condomínio+', contact_email = NULL, contact_phone = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `
      );
      setStatus({ type: 'success', message: 'Dados restaurados para os valores padrão.' });
      onUpdated();
    } catch (error) {
      setStatus({ type: 'error', message: 'Não foi possível restaurar os valores padrão.' });
      console.error('Failed to reset app settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card settings-card">
      <div className="card-header">
        <div>
          <h2>Dados do Administrador</h2>
          <p className="card-subtitle">
            Personalize o nome do gestor e os contactos apresentados na aplicação.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={saving}
          title="Restaurar valores padrão"
        >
          <RefreshCw size={16} />
          Restaurar
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nome do administrador</label>
          <input
            type="text"
            value={formData.administrator_name ?? ''}
            onChange={handleChange('administrator_name')}
            placeholder="Ex.: Maria Silva"
            maxLength={120}
          />
        </div>

        <div className="form-group">
          <label>Nome da empresa</label>
          <input
            type="text"
            value={formData.company_name ?? ''}
            onChange={handleChange('company_name')}
            placeholder="Ex.: Gestão Total, Lda."
            maxLength={120}
          />
        </div>

        <div className="form-row">
          <div className="form-group form-col-md">
            <label>Email de contacto</label>
            <input
              type="email"
              value={formData.contact_email ?? ''}
              onChange={handleChange('contact_email')}
              placeholder="Ex.: contacto@empresa.pt"
              maxLength={120}
            />
          </div>

          <div className="form-group form-col-sm">
            <label>Telefone</label>
            <input
              type="tel"
              value={formData.contact_phone ?? ''}
              onChange={handleChange('contact_phone')}
              placeholder="Ex.: +351 912 345 678"
              maxLength={40}
            />
          </div>
        </div>

        <div className="form-actions form-actions-spaced">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} />
            Guardar
          </button>
        </div>

        {status && (
          <p className={`status-message ${status.type}`}>
            {status.message}
          </p>
        )}
      </form>
    </div>
  );
}
