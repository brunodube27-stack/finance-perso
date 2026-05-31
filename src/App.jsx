import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import AddTransaction from './pages/AddTransaction'
import TransactionList from './pages/TransactionList'
import AddIncome from './pages/AddIncome'
import BudgetConfig from './pages/BudgetConfig'
import Dashboard from './pages/Dashboard'
import SavingsTracking from './pages/SavingsTracking'
import NetWorth from './pages/NetWorth'
import Metaux from './pages/Metaux'
import ImportCSV from './pages/ImportCSV'
import Soldes from './pages/Soldes'
import ManageComptes from './pages/ManageComptes'

const IconDashboard = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
)
const IconExpense = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <path d="M2 10h20"/>
  </svg>
)
const IconIncome = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)
const IconInvest = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/>
  </svg>
)
const IconMore = () => (
  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
  </svg>
)

const SUB_LABELS = {
  epargne: 'Épargne', networth: 'Net Worth', metaux: 'Métaux',
  transactions: 'Transactions', budget: 'Budget', import: 'Import CSV', soldes: 'Soldes', comptes: 'Comptes',
}

function SubTabs({ tabs, active, onSelect, color = 'indigo' }) {
  const activeClass = color === 'yellow'
    ? 'bg-amber-500 text-white'
    : 'bg-indigo-600 text-white'
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-2 px-4 py-3 border-b border-slate-100 bg-white" style={{ minWidth: 'max-content' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => onSelect(t)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${active === t ? activeClass : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {SUB_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [subPage, setSubPage] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-slate-400 text-sm">Chargement...</div>
    </div>
  )
  if (!session) return <Login />

  function navigate(p, sub = null) {
    setPage(p)
    setSubPage(sub)
  }

  function renderPage() {
    if (page === 'dashboard') return <Dashboard />
    if (page === 'add') return <AddTransaction />
    if (page === 'income') return <AddIncome />
    if (page === 'investissements') {
      const tab = subPage || 'epargne'
      return (
        <div>
          <SubTabs tabs={['epargne', 'networth', 'metaux']} active={tab} onSelect={setSubPage} color="yellow" />
          {tab === 'epargne' && <SavingsTracking />}
          {tab === 'networth' && <NetWorth />}
          {tab === 'metaux' && <Metaux />}
        </div>
      )
    }
    if (page === 'plus') {
      const tab = subPage || 'transactions'
      return (
        <div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white" style={{ minWidth: 'max-content' }}>
              {['transactions', 'budget', 'import', 'soldes', 'comptes'].map(t => (
                <button key={t} onClick={() => setSubPage(t)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {SUB_LABELS[t]}
                </button>
              ))}
              <button onClick={() => supabase.auth.signOut()}
                className="ml-2 px-3.5 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors whitespace-nowrap">
                Déconnexion
              </button>
            </div>
          </div>
          {tab === 'transactions' && <TransactionList />}
          {tab === 'budget' && <BudgetConfig />}
          {tab === 'import' && <ImportCSV />}
          {tab === 'soldes' && <Soldes />}
          {tab === 'comptes' && <ManageComptes />}
        </div>
      )
    }
  }

  const navItems = [
    { key: 'dashboard', label: 'Tableau', Icon: IconDashboard },
    { key: 'add', label: 'Dépense', Icon: IconExpense },
    { key: 'income', label: 'Revenu', Icon: IconIncome },
    { key: 'investissements', label: 'Invest.', Icon: IconInvest },
    { key: 'plus', label: 'Plus', Icon: IconMore },
  ]

  return (
    <div className="bg-slate-50 min-h-screen">
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        backgroundColor: 'white',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {navItems.map(({ key, label, Icon }) => {
          const active = page === key
          return (
            <button key={key} onClick={() => navigate(key)} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px 10px',
              gap: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? '#4f46e5' : '#94a3b8',
              transition: 'color 0.15s',
            }}>
              <Icon />
              <span style={{ fontSize: '10px', fontWeight: active ? '600' : '500', lineHeight: '1' }}>{label}</span>
            </button>
          )
        })}
      </nav>
      <div style={{ paddingBottom: '72px' }}>
        {renderPage()}
      </div>
    </div>
  )
}

export default App