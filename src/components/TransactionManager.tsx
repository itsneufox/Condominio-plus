import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Condominium, Transaction, Supplier } from '../types';

interface Props {
  condominium: Condominium;
}

export default function TransactionManager({ condominium }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categories, setCategories] = useState<{ id: number; name: string; year: number }[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    category: '',
    category_id: '',
    supplier_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    is_reserve_fund: false,
  });

  useEffect(() => {
    loadCategories();
    loadSuppliers();
    loadTransactions();
  }, [condominium]);

  useEffect(() => {
    loadTransactions();
  }, [filter]);

  const loadTransactions = async () => {
    let sql = `
      SELECT t.*,
             bc.name AS category_name,
             b.year AS category_year,
             s.name AS supplier_name
      FROM transactions t
      LEFT JOIN budget_categories bc ON t.category_id = bc.id
      LEFT JOIN budgets b ON bc.budget_id = b.id
      LEFT JOIN suppliers s ON t.supplier_id = s.id
      WHERE t.condominium_id = ?
    `;
    const params: any[] = [condominium.id];

    if (filter !== 'all') {
      sql += ' AND t.type = ?';
      params.push(filter);
    }

    sql += ' ORDER BY t.transaction_date DESC, t.created_at DESC';

    const result = await window.electronAPI.query(sql, params);
    if (result.success) {
      setTransactions(result.data || []);
    }
  };

  const loadCategories = async () => {
    const result = await window.electronAPI.query(
      `
        SELECT bc.id, bc.name, b.year
        FROM budget_categories bc
        JOIN budgets b ON bc.budget_id = b.id
        WHERE b.condominium_id = ?
        ORDER BY b.year DESC, bc.name ASC
      `,
      [condominium.id]
    );
    if (result.success) {
      setCategories(result.data || []);
    }
  };

  const loadSuppliers = async () => {
    const result = await window.electronAPI.query(
      'SELECT * FROM suppliers WHERE condominium_id = ? ORDER BY name',
      [condominium.id]
    );
    if (result.success) {
      setSuppliers(result.data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCategory = formData.category_id
      ? categories.find((category) => category.id === parseInt(formData.category_id))
      : undefined;
    const categoryLabel = formData.category || selectedCategory?.name || null;

    await window.electronAPI.run(
      `INSERT INTO transactions (
        condominium_id,
        type,
        category,
        category_id,
        supplier_id,
        amount,
        description,
        transaction_date,
        is_reserve_fund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        condominium.id,
        formData.type,
        categoryLabel,
        formData.category_id ? parseInt(formData.category_id) : null,
        formData.supplier_id ? parseInt(formData.supplier_id) : null,
        parseFloat(formData.amount),
        formData.description || null,
        formData.transaction_date,
        formData.is_reserve_fund ? 1 : 0,
      ]
    );

    setFormData({
      type: 'expense',
      category: '',
      category_id: '',
      supplier_id: '',
      amount: '',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0],
      is_reserve_fund: false,
    });
    setShowForm(false);
    loadTransactions();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-PT');
  };

  const formatCategoryCell = (transaction: Transaction) => {
    if (transaction.category_name) {
      if (transaction.category_year) {
        return `${transaction.category_name} (${transaction.category_year})`;
      }
      return transaction.category_name;
    }
    return transaction.category || '-';
  };

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;
  const balanceClass = balance >= 0 ? 'text-success' : 'text-danger';

  return (
    <div>
      <div className="stats-grid cols-3">
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Receitas</h3>
            <TrendingUp size={24} color="var(--success)" />
          </div>
          <div className="stat-card-value text-success">
            {formatCurrency(totalIncome)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Despesas</h3>
            <TrendingDown size={24} color="var(--danger)" />
          </div>
          <div className="stat-card-value text-danger">
            {formatCurrency(totalExpenses)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Saldo</h3>
          </div>
          <div className={`stat-card-value ${balanceClass}`}>{formatCurrency(balance)}</div>
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
              className={`btn ${filter === 'income' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('income')}
            >
              Receitas
            </button>
            <button
              className={`btn ${filter === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('expense')}
            >
              Despesas
            </button>
          </div>
          <button className="primary-btn" onClick={() => setShowForm(!showForm)}>
            <Plus size={20} />
            Novo Movimento
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="section-stack">
            <div className="form-group">
              <label>Tipo *</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })
                }
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>
            <div className="form-group">
              <label>Categoria do Orçamento</label>
              <select
                value={formData.category_id}
                onChange={(e) => {
                  const value = e.target.value;
                  const selected = categories.find((category) => category.id === parseInt(value));
                  setFormData({
                    ...formData,
                    category_id: value,
                    category:
                      value && !formData.category
                        ? selected?.name ?? ''
                        : formData.category,
                  });
                }}
              >
                <option value="">Sem ligação ao orçamento</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.year})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Categoria (texto livre)</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="ex: Manutenção, Limpeza, Quotas..."
              />
            </div>
            <div className="form-group">
              <label>Fornecedor</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              >
                <option value="">Sem fornecedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
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
              <label>Data *</label>
              <input
                type="date"
                required
                value={formData.transaction_date}
                onChange={(e) =>
                  setFormData({ ...formData, transaction_date: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={formData.is_reserve_fund}
                  onChange={(e) =>
                    setFormData({ ...formData, is_reserve_fund: e.target.checked })
                  }
                />
                Fundo de Reserva
              </label>
            </div>
            <div className="toolbar">
              <button type="submit" className="btn btn-primary">
                Adicionar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Fundo Reserva</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{formatDate(transaction.transaction_date)}</td>
                <td>
                  <span
                    className={`badge ${
                      transaction.type === 'income' ? 'badge-success' : 'badge-danger'
                    }`}
                  >
                    {transaction.type === 'income' ? (
                      <>
                        <TrendingUp size={16} /> Receita
                      </>
                    ) : (
                      <>
                        <TrendingDown size={16} /> Despesa
                      </>
                    )}
                  </span>
                </td>
                <td>{formatCategoryCell(transaction)}</td>
                <td>{transaction.supplier_name || '-'}</td>
                <td>{transaction.description || '-'}</td>
                <td className={`table-value-strong ${
                  transaction.type === 'income' ? 'text-success' : 'text-danger'
                }`}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </td>
                <td>{transaction.is_reserve_fund ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {transactions.length === 0 && (
          <p className="section-empty">Nenhum movimento registado.</p>
        )}
      </div>
    </div>
  );
}
