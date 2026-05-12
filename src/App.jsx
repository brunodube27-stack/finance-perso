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

  if (loading) return <div style={{ padding: '24px' }}>Chargement...</div>
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
          <div className="flex gap-2 p-4 border-b">
            {['epargne', 'networth', 'metaux'].map(t => (
              <button key={t} onClick={() => setSubPage(t)}
                className={`px-3 py-1 rounded-full text-sm ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                {t === 'epargne' ? 'Épargne' : t === 'networth' ? 'Net Worth' : 'Métaux'}
              </button>
            ))}
          </div>
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
          <div className="flex gap-2 p-4 border-b flex-wrap">
            {['transactions', 'budget', 'import'].map(t => (
              <button key={t} onClick={() => setSubPage(t)}
                className={`px-3 py-1 rounded-full text-sm ${tab === t ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>
                {t === 'transactions' ? 'Transactions' : t === 'budget' ? 'Budget' : 'Import CSV'}
              </button>
            ))}
            <button onClick={() => supabase.auth.signOut()}
              className="ml-auto px-3 py-1 rounded-full text-sm bg-red-50 text-red-600 border border-red-200">
              Déconnexion
            </button>
          </div>
          {tab === 'transactions' && <TransactionList />}
          {tab === 'budget' && <BudgetConfig />}
          {tab === 'import' && <ImportCSV />}
        </div>
      )
    }
  }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', color: 'blue' },
    { key: 'add', label: '+ Dépense', color: 'red' },
    { key: 'income', label: '+ Revenu', color: 'green' },
    { key: 'investissements', label: 'Invest.', color: 'yellow' },
    { key: 'plus', label: 'Plus', color: 'gray' },
  ]

  return (
    <div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, backgroundColor: 'white', borderTop: '1px solid #e5e7eb', display: 'flex' }}>
        {navItems.map(({ key, label, color }) => (
          <button key={key} onClick={() => navigate(key)}
            style={{ flex: 1, padding: '12px 4px', fontSize: '11px', fontWeight: '500', color: page === key ? '#2563eb' : '#6b7280', borderTop: page === key ? '2px solid #2563eb' : '2px solid transparent', background: 'none', border: 'none', borderTop: page === key ? '2px solid #2563eb' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ paddingBottom: '80px' }}>
        {renderPage()}
      </div>
    </div>
  )
}

export default App