'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCostStats, getUsageRecords, type CostStats, type APIRoute } from '@/lib/openai-costs'

// ─── Auth ─────────────────────────────────────────────────────────────────────
const SESSION_KEY    = 'plena-admin-session'
const SESSION_PIN_KEY = 'plena-admin-pin'

// ─── Rate limit stats type (client-side mirror — pas d'import server) ─────────
interface RLAbuseEvent {
  timestamp: number
  identifier: string
  route: string
  limitType: 'hourly' | 'daily'
  count: number
  limit: number
}
interface RLStats {
  totalBlocked: number
  byRoute: Record<string, { blocked: number; allowed: number }>
  recentEvents: RLAbuseEvent[]
  topAbusers: { identifier: string; count: number }[]
  uptimeMs: number
  storeSize: number
}

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
    violet: 'bg-[#DEE8FF] border-[#DDD6FE]',
    orange: 'bg-orange-50 border-orange-200',
    green:  'bg-green-50 border-green-100',
    gray:   'bg-gray-50 border-gray-200',
  }
  const text = {
    violet: 'text-[#4F7CFF]',
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
      <td className="py-2.5 pr-4 text-sm font-bold text-[#1D1D1F]">{label}</td>
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
                  ? 'bg-[#4F7CFF]'
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
        sessionStorage.setItem(SESSION_PIN_KEY, pin.trim())  // used for rate-limit-stats API
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
            <div className="w-16 h-16 bg-[#DEE8FF] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              🔐
            </div>
            <h1 className="text-xl font-black text-[#1D1D1F]">Admin Analytics</h1>
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
                         focus:outline-none focus:border-[#4F7CFF] focus:ring-2 focus:ring-[#4F7CFF]/20"
            />
            {error && (
              <p className="text-sm text-red-500 text-center font-semibold">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="w-full bg-[#4F7CFF] text-white font-black py-3 rounded-2xl disabled:opacity-50"
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
  const [stats, setStats]         = useState<CostStats | null>(null)
  const [rlStats, setRlStats]     = useState<RLStats | null>(null)
  const [rlError, setRlError]     = useState<string | null>(null)
  const [recordCount, setRecordCount] = useState(0)
  const [refreshed, setRefreshed] = useState(new Date())

  const loadRLStats = useCallback(async () => {
    try {
      const pin = sessionStorage.getItem(SESSION_PIN_KEY) ?? ''
      const res = await fetch('/api/rate-limit-stats', {
        headers: { Authorization: `Bearer ${pin}` },
      })
      if (!res.ok) { setRlError('Non autorisé ou serveur indisponible'); return }
      const data: RLStats = await res.json()
      setRlStats(data)
      setRlError(null)
    } catch {
      setRlError('Impossible de récupérer les stats (hors ligne ?)')
    }
  }, [])

  const load = useCallback(() => {
    setStats(getCostStats())
    setRecordCount(getUsageRecords(90).length)
    setRefreshed(new Date())
    void loadRLStats()
  }, [loadRLStats])

  useEffect(() => { load() }, [load])

  const handleClear = () => {
    if (!confirm('Effacer tout l\'historique de tracking ? Cette action est irréversible.')) return
    localStorage.removeItem('plena-usage-log')
    load()
  }

  if (!stats) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#4F7CFF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hasData = stats.totalCalls > 0

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 pt-12 pb-5 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <p className="text-[11px] font-bold text-[#4F7CFF] uppercase tracking-wide">Admin</p>
            <h1 className="text-xl font-black text-[#1D1D1F]">Analytics OpenAI</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="text-sm text-[#4F7CFF] font-black bg-[#DEE8FF] px-3 py-1.5 rounded-xl"
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
            <p className="font-black text-[#1D1D1F] text-lg">Aucune donnée encore</p>
            <p className="text-sm text-gray-500 mt-1">
              Effectue une correction ou un quiz pour commencer le tracking.
            </p>
          </div>
        )}

        {/* ── Coûts par période ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-black text-[#1D1D1F]">Coûts par période</h2>
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
              <h2 className="font-black text-[#1D1D1F]">Coût / jour — 14j</h2>
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
          <h2 className="font-black text-[#1D1D1F] mb-4">Routes — 30 derniers jours</h2>
          <div className="space-y-3">
            {(Object.entries(stats.byRoute) as [APIRoute, { calls: number; costUsd: number }][])
              .sort((a, b) => b[1].calls - a[1].calls)
              .map(([route, data]) => {
                const totalCalls = stats.d30.calls || 1
                const barPct = (data.calls / totalCalls) * 100
                return (
                  <div key={route}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#1D1D1F]">
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
                        className="bg-[#4F7CFF] h-1.5 rounded-full transition-all"
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

        {/* ── Rate Limiting ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-black text-[#1D1D1F]">🛡️ Rate Limiting</h2>
              <p className="text-xs text-gray-400 mt-0.5">Compteurs en mémoire — reset au redémarrage serveur</p>
            </div>
            {rlStats && (
              <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">
                uptime {Math.floor(rlStats.uptimeMs / 60000)}m · {rlStats.storeSize} clés
              </span>
            )}
          </div>

          {rlError && (
            <div className="mx-5 mb-4 bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3">
              <p className="text-xs text-yellow-700 font-semibold">⚠️ {rlError}</p>
              <p className="text-[10px] text-yellow-600 mt-0.5">Les stats sont serveur-side — disponibles uniquement en production.</p>
            </div>
          )}

          {rlStats && (
            <div className="px-5 pb-5 space-y-4">
              {/* Total bloqué */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Total bloqué</p>
                  <p className="text-2xl font-black text-red-700">{rlStats.totalBlocked}</p>
                </div>
                {(['correct-homework', 'generate-questions', 'check-answers'] as const).map(route => {
                  const c = rlStats.byRoute[route]
                  const emojiMap: Record<string, string> = { 'correct-homework': '📝', 'generate-questions': '🧠', 'check-answers': '✅' }
                  const total = (c?.blocked ?? 0) + (c?.allowed ?? 0)
                  const blockRate = total > 0 ? Math.round(((c?.blocked ?? 0) / total) * 100) : 0
                  return (
                    <div key={route} className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate">{emojiMap[route]}</p>
                      <p className="text-lg font-black text-[#1D1D1F]">{c?.blocked ?? 0}<span className="text-xs font-normal text-gray-400">/{total}</span></p>
                      <p className="text-[10px] text-gray-400">{blockRate}% bloqué</p>
                    </div>
                  )
                })}
              </div>

              {/* Limites configurées */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Limites actives (tier FREE)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-gray-400 uppercase border-b border-gray-100">
                        <th className="pb-1.5 text-left pr-3">Route</th>
                        <th className="pb-1.5 text-center pr-3">/ heure</th>
                        <th className="pb-1.5 text-center pr-3">/ jour</th>
                        <th className="pb-1.5 text-center">Autorisés</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ['correct-homework',   '📝 Correction',  30,  100],
                        ['generate-questions', '🧠 Génération',  20,  50 ],
                        ['check-answers',      '✅ Quiz',         50,  150],
                      ] as [string, string, number, number][]).map(([route, label, h, d]) => (
                        <tr key={route} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 pr-3 font-medium text-[#1D1D1F]">{label}</td>
                          <td className="py-2 pr-3 text-center font-mono text-[#4F7CFF] font-bold">{h}</td>
                          <td className="py-2 pr-3 text-center font-mono text-[#4F7CFF] font-bold">{d}</td>
                          <td className="py-2 text-center font-bold text-green-700">{rlStats.byRoute[route]?.allowed ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top abusers */}
              {rlStats.topAbusers.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Top abuseurs (IP masquée)</p>
                  <div className="space-y-1.5">
                    {rlStats.topAbusers.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2">
                        <span className="text-[11px] font-mono text-orange-800">{a.identifier}</span>
                        <span className="text-[11px] font-black text-orange-700">{a.count} block{a.count > 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Derniers événements */}
              {rlStats.recentEvents.length > 0 ? (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Dernières limites atteintes ({rlStats.recentEvents.length})
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {rlStats.recentEvents.map((ev, i) => {
                      const emojiMap: Record<string, string> = { 'correct-homework': '📝', 'generate-questions': '🧠', 'check-answers': '✅' }
                      const time = new Date(ev.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      const day  = new Date(ev.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                      return (
                        <div key={i} className="flex items-center gap-2 text-[11px] bg-gray-50 rounded-xl px-3 py-2">
                          <span>{emojiMap[ev.route] ?? '?'}</span>
                          <span className="font-mono text-gray-500">{day} {time}</span>
                          <span className="flex-1 font-mono text-gray-600 truncate">{ev.identifier}</span>
                          <span className={`font-black px-1.5 py-0.5 rounded-md text-[10px] ${
                            ev.limitType === 'hourly' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {ev.limitType === 'hourly' ? 'horaire' : 'jour'} {ev.count}/{ev.limit}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-2xl mb-1">✅</p>
                  <p className="text-sm font-bold text-green-700">Aucun abus détecté</p>
                  <p className="text-xs text-gray-400">Les limites n'ont pas encore été déclenchées.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Projection premium ── */}
        <div className="bg-[#DEE8FF] border border-[#DDD6FE] rounded-3xl p-5">
          <h2 className="font-black text-[#4F7CFF] mb-3">💡 Projection abonnement</h2>
          <div className="space-y-2">
            {[2.99, 3.99, 4.99, 5.99].map(price => {
              const monthlyApiCostEur = (stats.d30.costUsd / EUR_RATE)
              const margin = price - monthlyApiCostEur
              const pctMargin = price > 0 ? ((margin / price) * 100).toFixed(0) : '—'
              return (
                <div key={price} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#6D28D9]">{price.toFixed(2)} €/mois</span>
                  <span className="text-sm text-[#1D1D1F]">
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
          <p className="text-[10px] text-[#4F7CFF] mt-3 opacity-70">
            Basé sur le coût réel des 30 derniers jours · 1 € = ${EUR_RATE}
          </p>
        </div>

        {/* ── Données brutes ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-[#1D1D1F]">Exemple de données stockées</h2>
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
