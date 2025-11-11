import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Condominium } from '../types';

interface Props {
  condominium: Condominium;
}

interface Stats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  reserveFund: number;
  budgetYear: number | null;
  budgetTotal: number | null;
  budgetUsed: number;
}

export default function Dashboard({ condominium }: Props) {
  const [stats, setStats] = useState<Stats>({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    reserveFund: 0,
    budgetYear: null,
    budgetTotal: null,
    budgetUsed: 0,
  });

  useEffect(() => {
    loadStats();
  }, [condominium]);

  const loadStats = async () => {
    const incomeResult = await window.electronAPI.get(
      'SELECT SUM(amount) as total FROM transactions WHERE condominium_id = ? AND type = "income" AND is_reserve_fund = 0',
      [condominium.id]
    );

    const expensesResult = await window.electronAPI.get(
      'SELECT SUM(amount) as total FROM transactions WHERE condominium_id = ? AND type = "expense" AND is_reserve_fund = 0',
      [condominium.id]
    );

    const reserveIncomeResult = await window.electronAPI.get(
      'SELECT SUM(amount) as total FROM transactions WHERE condominium_id = ? AND type = "income" AND is_reserve_fund = 1',
      [condominium.id]
    );

    const reserveExpensesResult = await window.electronAPI.get(
      'SELECT SUM(amount) as total FROM transactions WHERE condominium_id = ? AND type = "expense" AND is_reserve_fund = 1',
      [condominium.id]
    );

    const currentYear = new Date().getFullYear();
    const budgetResult = await window.electronAPI.get(
      'SELECT * FROM budgets WHERE condominium_id = ? AND year = ?',
      [condominium.id, currentYear]
    );

    const totalIncome = incomeResult.data?.total || 0;
    const totalExpenses = expensesResult.data?.total || 0;
    const reserveIncome = reserveIncomeResult.data?.total || 0;
    const reserveExpenses = reserveExpensesResult.data?.total || 0;

    setStats({
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      reserveFund: reserveIncome - reserveExpenses,
      budgetYear: budgetResult.data?.year || null,
      budgetTotal: budgetResult.data?.total_amount || null,
      budgetUsed: totalExpenses,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const balanceClass = stats.balance >= 0 ? 'text-success' : 'text-danger';
  const budgetUsagePercent = stats.budgetTotal
    ? Math.min((stats.budgetUsed / stats.budgetTotal) * 100, 100)
    : 0;
  const budgetBarTone = stats.budgetUsed > (stats.budgetTotal || 0) ? 'danger' : 'success';

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Receitas Totais</h3>
            <TrendingUp size={24} color="var(--success)" />
          </div>
          <div className="stat-card-value text-success">
            {formatCurrency(stats.totalIncome)}
          </div>
          <div className="stat-card-footer">Todas as receitas registadas</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Despesas Totais</h3>
            <TrendingDown size={24} color="var(--danger)" />
          </div>
          <div className="stat-card-value text-danger">
            {formatCurrency(stats.totalExpenses)}
          </div>
          <div className="stat-card-footer">Todas as despesas registadas</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Saldo Atual</h3>
            <DollarSign size={24} color="var(--primary)" />
          </div>
          <div className={`stat-card-value ${balanceClass}`}>{formatCurrency(stats.balance)}</div>
          <div className="stat-card-footer">Receitas - Despesas</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Fundo de Reserva</h3>
            <Wallet size={24} color="var(--warning)" />
          </div>
          <div className="stat-card-value text-warning">
            {formatCurrency(stats.reserveFund)}
          </div>
          <div className="stat-card-footer">Saldo do fundo de reserva</div>
        </div>
      </div>

      {stats.budgetYear && stats.budgetTotal && (
        <div className="card card-content-gap">
          <div>
            <h3 className="section-title">Orçamento {stats.budgetYear}</h3>
            <div className="list-inline">
              <span>Utilizado: <strong>{formatCurrency(stats.budgetUsed)}</strong></span>
              <span>Total: <strong>{formatCurrency(stats.budgetTotal)}</strong></span>
            </div>
          </div>

          <div className="progress">
            <div
              className={`progress-bar ${budgetBarTone}`}
              style={{ width: `${budgetUsagePercent}%` }}
            />
          </div>

          <p className="section-hint">
            {stats.budgetUsed > stats.budgetTotal
              ? `Orçamento excedido em ${formatCurrency(stats.budgetUsed - stats.budgetTotal)}`
              : `Disponível: ${formatCurrency(stats.budgetTotal - stats.budgetUsed)}`}
          </p>
        </div>
      )}

      {!stats.budgetYear && (
        <div className="card">
          <p className="section-hint center">
            Nenhum orçamento definido para o ano atual. Crie um orçamento na seção "Orçamento".
          </p>
        </div>
      )}
    </div>
  );
}
