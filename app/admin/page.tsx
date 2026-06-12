'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCostStats, getUsageRecords, type CostStats, type APIRoute } from '@/lib/openai-costs'

// ─── Auth ─────────────────────────────────────────────────────────────────────
const SESSION_KEY = 'plena-admin-session'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EUR_RATE = 1.09   // 1 EUR = $1.09 — update as needed
const usd = (v: number) => `$${v.toFixed(4)}`
const eur = (v: number) => `€${(v / EUR_RATE).toFixed(4)}`
const usdShort = (v: number) => v < 0.01 ? `$${(v * 100).toFixed(3)}¢` : `$${v.toFixed(3)}`
const pct = (part: number, total: number) => total > 0 ? `${((part / total) * 100).toFixed(0)}%` : '—'

const ROUTE_LABELS: Record<APIRoute, string> = {
  'correct-homework':   '📝 Correction',
  'generate-questions': '🧠 Génération quiz',
  'check-answers':      '✅ Correction quiz',
}

function fmtBoth(v: number) {
  return `${usd(v)} · €${(v / EUR_RATE).toFixed(4)}`
}

// ─── Components ───────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color = 'violet'
}: { label: string; value: string; sub?: string; color?: 'violet' | 'orange' | 'green' | 'gray' }) {
  const colors = {
    violet: 'bg-[#EDE9FE] border-[#DDD6FE]',
    orange: 'bg-orange-50 border-orange-200',
    green:  'bg-green-50 border-green-100',
    gray:   'bg-gray-50 border-gray-200',
  }
  const text = {
    violet: 'text-[#8B5CF6]',
    orange: 'text-orange-700',
    green:  'text-green-700',
    gray:   'text-gray-600',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${text[color]}`}>{label}</p>
      <p className={`text-xl font-black ${text[color]}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{sub}</p>}
    </div>
  )
}

function PeriodRow({
  label, costUsd, calls, corrections, quizGen
}: { label: string; costUsd: number; calls: number; corrections: number; quizGen: number }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2.5 pr-4 text-sm font-bold text-[#1F2937]">{label}</td>
      <td className="py-2.5 pr-4 text-sm font-mono text-orange-700 font-black">{usd(costUsd)}</td>
      <td className="py-2.5 pr-4 text-sm font-mono text-gray-500">{eur(costUsd)}</td>
      <td className="py-2.5 pr-2 text-sm text-center font-medium text-gray-600">{calls}</td>
      <td className="py-2.5 pr-2 text-sm text-center font-medium text-gray-500">{corrections}</td>
      <td className="py-2.5 text-sm text-center font-medium text-gray-500">{quizGen}</td>
    </tr>
  )
}

// Simple bar sparkline — CSS only
function Sparkline({ data }: { data: { date: string; costUsd: number }[] }) {
  const max = Math.max(...data.map(d => d.costUsd), 0.0001)
  return (
    <div className="flex items-end gap-[3px] h-12">
      {data.map((d, i) => {
        const h = Math.max((d.costUsd / max) * 100, d.costUsd > 0 ? 8 : 2)
        const isToday = i === data.length - 1
        return (
          <div
            key={d.date}
            title={`${d.date}: ${usd(d.costUsd)}`}
            style={{ height: `${h}%` }}
            className={`flex-1 rounded-t-sm ${
              isToday
                ? 'bg-orange-500'
                : d.costUsd > 0
                  ? 'bg-[#8B5CF6]'
                  : 'bg-gray-200'
            }`}
          />
        )
      })}
    </div>
  )
}

// ─── PIN Screen ───────────────────────────────────────────────────────────────
function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        sessionStorage.setItem(SESSION_KEY, '1')
        onUnlock()
      } else {
        setError('Code incorrect')
        setPin('')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#EDE9FE] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              🔐
            </div>
            <h1 className="text-xl font-black text-[#1F2937]">Admin Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Professeur Léna</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Code admin"
              autoFocus
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-center text-lg font-mono tracking-widest
                         focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
            />
            {error && (
              <p className="text-sm text-red-500 text-center font-semibold">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="w-full bg-[#8B5CF6] text-white font-black py-3 rounded-2xl disabled:opacity-50"
            >
              {loading ? 'Vérification…' : 'Accéder →'}
            </button>
          </form>
          <p className="text-[11px] text-gray-300 text-center mt-6">
            Définir via env ADMIN_CODE · défaut : lena-admin
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState<CostStats | null>(null)
  const [recordCount, setRecordCount] = useState(0)
  const [refreshed, setRefreshed] = useState(new Date())

  const load = useCallback(() => {
    setStats(getCostStats())
    setRecordCount(getUsageRecords(90).length)
    setRefreshed(new Date())
  }, [])

  useEffect(() => { load() }, [load])

  const handleClear = () => {
    if (!confirm('Effacer tout l\'historique de tracking ? Cette action est irréversible.')) return
    localStorage.removeItem('plena-usage-log')
    load()
  }

  if (!stats) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hasData = stats.totalCalls > 0

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 pt-12 pb-5 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <p className="text-[11px] font-bold text-[#8B5CF6] uppercase tracking-wide">Admin</p>
            <h1 className="text-xl font-black text-[#1F2937]">Analytics OpenAI</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="text-sm text-[#8B5CF6] font-black bg-[#EDE9FE] px-3 py-1.5 rounded-xl"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 max-w-2xl mx-auto">
          Mis à jour à {refreshed.toLocaleTimeString('fr-FR')} · {recordCount} enregistrement(s) · 90j max
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {!hasData && (
          <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 text-center">
            <p className="text-3xl mb-2">📊</p>
            <p className="font-black text-[#1F2937] text-lg">Aucune donnée encore</p>
            <p className="text-sm text-gray-500 mt-1">
              Effectue une correction ou un quiz pour commencer le tracking.
            </p>
          </div>
        )}

        {/* ── Coûts par période ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-black text-[#1F2937]">Coûts par période</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tous les appels OpenAI confondus</p>
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-2 text-left pr-4">Période</th>
                  <th className="pb-2 text-left pr-4">Coût ($)</th>
                  <th className="pb-2 text-left pr-4">Coût (€)</th>
                  <th className="pb-2 text-center pr-2">Appels</th>
                  <th className="pb-2 text-center pr-2">Correct.</th>
                  <th className="pb-2 text-center">Quiz</th>
                </tr>
              </thead>
              <tbody>
                <PeriodRow label="Aujourd'hui" {...stats.today} costUsd={stats.today.costUsd} />
                <PeriodRow label="7 derniers jours" {...stats.d7} costUsd={stats.d7.costUsd} />
                <PeriodRow label="30 derniers jours" {...stats.d30} costUsd={stats.d30.costUsd} />
                <PeriodRow label="90 derniers jours" {...stats.d90} costUsd={stats.d90.costUsd} />
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Sparkline ── */}
        {hasData && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-[#1F2937]">Coût / jour — 14j</h2>
              <span className="text-xs text-gray-400">🟣 passé · 🟠 auj.</span>
            </div>
            <Sparkline data={stats.dailyCosts} />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-300">
                {stats.dailyCosts[0]?.date.slice(5)}
              </span>
              <span className="text-[10px] text-gray-300">
                {stats.dailyCosts[stats.dailyCosts.length - 1]?.date.slice(5)}
              </span>
            </div>
          </div>
        )}

        {/* ── Moyennes par action ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Coût moy. correction"
            value={usdShort(stats.avgCostPerCorrection)}
            sub={`€${(stats.avgCostPerCorrection / EUR_RATE).toFixed(4)}`}
            color="violet"
          />
          <StatCard
            label="Coût moy. quiz (gen)"
            value={usdShort(stats.avgCostPerQuizSession)}
            sub={`€${(stats.avgCostPerQuizSession / EUR_RATE).toFixed(4)}`}
            color="orange"
          />
          <StatCard
            label="Total appels (90j)"
            value={String(stats.totalCalls)}
            sub="tous types confondus"
            color="gray"
          />
          <StatCard
            label="Coût total (90j)"
            value={usd(stats.totalCostUsd)}
            sub={`€${(stats.totalCostUsd / EUR_RATE).toFixed(4)}`}
            color="green"
          />
        </div>

        {/* ── Breakdown par route (30j) ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-black text-[#1F2937] mb-4">Routes — 30 derniers jours</h2>
          <div className="space-y-3">
            {(Object.entries(stats.byRoute) as [APIRoute, { calls: number; costUsd: number }][])
              .sort((a, b) => b[1].calls - a[1].calls)
              .map(([route, data]) => {
                const totalCalls = stats.d30.calls || 1
                const barPct = (data.calls / totalCalls) * 100
                return (
                  <div key={route}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#1F2937]">
                        {ROUTE_LABELS[route]}
                      </span>
                      <span className="text-sm font-mono text-orange-700 font-black">
                        {usd(data.costUsd)}
                        <span className="text-[10px] text-gray-400 font-normal ml-1">
                          · {data.calls} appel{data.calls !== 1 ? 's' : ''}
                          {' '}· {pct(data.calls, stats.d30.calls)}
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-[#8B5CF6] h-1.5 rounded-full transition-all"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            <p className="text-[11px] text-gray-400 pt-1">
              Route dominante (tous temps) :{' '}
              <strong>{stats.topRoute !== '—' ? ROUTE_LABELS[stats.topRoute as APIRoute] ?? stats.topRoute : '—'}</strong>
            </p>
          </div>
        </div>

        {/* ── Projection premium ── */}
        <div className="bg-[#EDE9FE] border border-[#DDD6FE] rounded-3xl p-5">
          <h2 className="font-black text-[#8B5CF6] mb-3">💡 Projection abonnement</h2>
          <div className="space-y-2">
            {[2.99, 3.99, 4.99, 5.99].map(price => {
              const monthlyApiCostEur = (stats.d30.costUsd / EUR_RATE)
              const margin = price - monthlyApiCostEur
              const pctMargin = price > 0 ? ((margin / price) * 100).toFixed(0) : '—'
              return (
                <div key={price} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#6D28D9]">{price.toFixed(2)} €/mois</span>
                  <span className="text-sm text-[#1F2937]">
                    marge{' '}
                    <strong className={margin > 0 ? 'text-green-700' : 'text-red-600'}>
                      {margin > 0 ? `€${margin.toFixed(2)}` : `−€${Math.abs(margin).toFixed(2)}`}
                    </strong>
                    {' '}
                    <span className="text-gray-500 text-xs">({pctMargin}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-[#8B5CF6] mt-3 opacity-70">
            Basé sur le coût réel des 30 derniers jours · 1 € = ${EUR_RATE}
          </p>
        </div>

        {/* ── Données brutes ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-[#1F2937]">Exemple de données stockées</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-mono">
              localStorage: plena-usage-log
            </span>
          </div>
          <pre className="text-[10px] text-gray-600 bg-gray-50 rounded-xl p-3 overflow-x-auto leading-relaxed font-mono">
{`{
  "id": "1749000000-a3b4",
  "date": "2026-06-12T14:32:11.000Z",
  "route": "correct-homework",
  "model": "gpt-4o",
  "promptTokens": 1443,
  "completionTokens": 648,
  "totalTokens": 2091,
  "estimatedCostUsd": 0.010078
}`}
          </pre>
        </div>

        {/* ── Danger zone ── */}
        <div className="bg-red-50 border border-red-100 rounded-3xl p-5">
          <h2 className="font-black text-red-700 mb-2">⚠️ Zone danger</h2>
          <p className="text-sm text-red-600 mb-4">
            Efface tout l'historique de tracking des coûts (90 jours). Irréversible.
          </p>
          <button
            onClick={handleClear}
            className="bg-red-500 text-white font-black text-sm px-4 py-2 rounded-xl"
          >
            Effacer l'historique
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Page entry ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null)

  useEffect(() => {
    const ok = sessionStorage.getItem(SESSION_KEY) === '1'
    setUnlocked(ok)
  }, [])

  if (unlocked === null) return null  // SSR guard

  if (!unlocked) {
    return <PinScreen onUnlock={() => setUnlocked(true)} />
  }

  return <Dashboard />
}
