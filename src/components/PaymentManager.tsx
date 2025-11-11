import { useEffect, useMemo, useState } from 'react';
import { Plus, CheckCircle2, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import { Condominium, Payment } from '../types';

interface Props {
  condominium: Condominium;
}

interface UnitOption {
  id: number;
  unit_number: string;
}

type PaymentStatus = 'all' | 'pending' | 'paid' | 'overdue';

export default function PaymentManager({ condominium }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<PaymentStatus>('all');

  const [formData, setFormData] = useState({
    unit_id: '',
    amount: '',
    period: '',
    payment_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    status: 'pending' as Payment['status'],
    notes: '',
  });

  useEffect(() => {
    loadUnits();
  }, [condominium]);

  useEffect(() => {
    loadPayments();
  }, [condominium, filter]);

  const loadUnits = async () => {
    const result = await window.electronAPI.query(
      'SELECT id, unit_number FROM units WHERE condominium_id = ? ORDER BY unit_number',
      [condominium.id]
    );
    if (result.success) {
      setUnits(result.data || []);
    }
  };

  const loadPayments = async () => {
    let sql = `
      SELECT p.*, u.unit_number
      FROM payments p
      JOIN units u ON p.unit_id = u.id
      WHERE u.condominium_id = ?
    `;
    const params: any[] = [condominium.id];

    if (filter !== 'all') {
      sql += ' AND p.status = ?';
      params.push(filter);
    }

    sql += ' ORDER BY COALESCE(p.due_date, p.payment_date) DESC, p.created_at DESC';

    const result = await window.electronAPI.query(sql, params);
    if (result.success) {
      setPayments(result.data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit_id) return;

    await window.electronAPI.run(
      `INSERT INTO payments (unit_id, amount, payment_date, due_date, period, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(formData.unit_id),
        parseFloat(formData.amount),
        formData.payment_date,
        formData.due_date || null,
        formData.period || null,
        formData.status,
        formData.notes || null,
      ]
    );

    setFormData({
      unit_id: '',
      amount: '',
      period: '',
      payment_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setShowForm(false);
    loadPayments();
  };

  const handleStatusChange = async (paymentId: number, status: Payment['status']) => {
    const paidAt = status === 'paid' ? new Date().toISOString().split('T')[0] : null;
    await window.electronAPI.run(
      'UPDATE payments SET status = ?, paid_at = ? WHERE id = ?',
      [status, paidAt, paymentId]
    );
    loadPayments();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('pt-PT');
  };

  const stats = useMemo(() => {
    const totals = { pending: 0, paid: 0, overdue: 0, total: 0 };
    payments.forEach((payment) => {
      totals.total += payment.amount;
      totals[payment.status] += payment.amount;
    });
    return totals;
  }, [payments]);

  const statusBadge = (status: Payment['status']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="badge badge-success">
            <CheckCircle2 />
            Pago
          </span>
        );
      case 'overdue':
        return (
          <span className="badge badge-danger">
            <AlertCircle />
            Vencido
          </span>
        );
      default:
        return (
          <span className="badge badge-warning">
            <Clock />
            Pendente
          </span>
        );
    }
  };

  return (
    <div>
      <div className="stats-grid cols-4">
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total Previsto</h3>
          </div>
          <div className="stat-card-value">{formatCurrency(stats.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Pendente</h3>
          </div>
          <div className="stat-card-value text-warning">
            {formatCurrency(stats.pending)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Pago</h3>
          </div>
          <div className="stat-card-value text-success">
            {formatCurrency(stats.paid)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Vencido</h3>
          </div>
          <div className="stat-card-value text-danger">
            {formatCurrency(stats.overdue)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="toolbar">
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              Todos
            </button>
            <button
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('pending')}
            >
              Pendentes
            </button>
            <button
              className={`btn ${filter === 'paid' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('paid')}
            >
              Pagos
            </button>
            <button
              className={`btn ${filter === 'overdue' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('overdue')}
            >
              Vencidos
            </button>
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              setShowForm(!showForm);
              setFormData({
                unit_id: '',
                amount: '',
                period: '',
                payment_date: new Date().toISOString().split('T')[0],
                due_date: new Date().toISOString().split('T')[0],
                status: 'pending',
                notes: '',
              });
            }}
          >
            <Plus size={20} />
            Nova Quota
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="section-stack">
            <div className="form-group">
              <label>Fração *</label>
              <select
                required
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              >
                <option value="">Selecione uma fração...</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Valor *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Período</label>
              <input
                type="text"
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                placeholder="ex: Janeiro 2025"
              />
            </div>
            <div className="form-group">
              <label>Data de Emissão *</label>
              <input
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Data de Vencimento *</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Payment['status'] })}
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="toolbar">
              <button type="submit" className="btn btn-primary">
                Registar
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Fração</th>
              <th>Período</th>
              <th>Valor</th>
              <th>Emissão</th>
              <th>Vencimento</th>
              <th>Estado</th>
              <th>Pago em</th>
              <th>Notas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.unit_number}</td>
                <td>{payment.period || '-'}</td>
                <td className="table-value-strong">{formatCurrency(payment.amount)}</td>
                <td>{formatDate(payment.payment_date)}</td>
                <td>{formatDate(payment.due_date)}</td>
                <td>{statusBadge(payment.status)}</td>
                <td>{formatDate(payment.paid_at)}</td>
                <td className="table-col-notes">
                  <span className="table-note">{payment.notes || '-'}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => handleStatusChange(payment.id, 'pending')}
                      title="Marcar como pendente"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      className="btn btn-secondary btn-icon-sm"
                      onClick={() => handleStatusChange(payment.id, 'paid')}
                      title="Marcar como pago"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon-sm"
                      onClick={() => handleStatusChange(payment.id, 'overdue')}
                      title="Marcar como vencido"
                    >
                      <AlertCircle size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {payments.length === 0 && !showForm && (
          <p className="section-empty">
            Nenhuma quota registada.
          </p>
        )}
      </div>
    </div>
  );
}
