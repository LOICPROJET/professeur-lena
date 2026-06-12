'use client'

import { useState, useEffect, useCallback } from 'react'
import BottomNav from '@/components/BottomNav'
import WeekTimeline from '@/components/WeekTimeline'
import {
  getOrCreateActiveChild,
  getChildren,
  setActiveChildId,
  generateWeeklyReport,
  saveWeeklyReport,
  getWeeklyReports,
  getAllHomework,
} from '@/lib/storage'
import { ChildProfile, WeeklyReport, HomeworkRecord, SUBJECT_EMOJI } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return `${s.toLocaleDateString('fr-FR', opts)} – ${e.toLocaleDateString('fr-FR', opts)}`
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function subjectEmoji(s: string | null): string {
  return s ? (SUBJECT_EMOJI[s] ?? '✨') : '✨'
}

// ─── Score trend badge ────────────────────────────────────────────────────────

function ScoreTrend({ trend }: { trend: number }) {
  if (trend === 0) return <span className="text-sm font-semibold text-gray-400">—</span>
  const positive = trend > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xl font-black ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '▲' : '▼'} {Math.abs(trend)}
    </span>
  )
}

// ─── Full report card ─────────────────────────────────────────────────────────

function ReportCard({ report }: { report: WeeklyReport }) {
  const scoreColor =
    report.averageScore >= 15 ? 'text-green-600' :
    report.averageScore >= 10 ? 'text-amber-600' :
    'text-red-500'

  return (
    <div className="flex flex-col gap-4">

      {/* Summary header */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Semaine</p>
            <p className="text-sm font-bold text-[#1F2937]">{formatWeekRange(report.weekStart, report.weekEnd)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Exercices</p>
            <p className="text-3xl font-black text-[#1F2937]">{report.totalCorrections}</p>
          </div>
        </div>
        <p className="text-sm text-[#4B5563] leading-relaxed">{report.parentSummary}</p>
        <p className="text-[10px] text-gray-300 mt-3 font-medium">Généré le {formatGeneratedAt(report.generatedAt)}</p>
      </div>

      {/* Stats grid */}
      {report.totalCorrections > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 flex flex-col items-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Moyenne</p>
            <p className={`text-4xl font-black ${scoreColor}`}>{report.averageScore}</p>
            <p className="text-xs text-gray-400 font-medium">/20</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 flex flex-col items-center justify-center gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Tendance</p>
            <ScoreTrend trend={report.scoreTrend} />
            {report.scoreTrend !== 0 && (
              <p className="text-[10px] text-gray-400 font-medium">vs sem. précédente</p>
            )}
          </div>
        </div>
      )}

      {/* Subject highlights */}
      {(report.mostWorkedSubject || report.bestSubject) && (
        <div className="grid grid-cols-2 gap-3">
          {report.mostWorkedSubject && (
            <div className="bg-primary-50 rounded-3xl p-4">
              <p className="text-[10px] font-semibold text-primary-400 uppercase tracking-wide mb-2">Plus travaillée</p>
              <p className="text-3xl mb-1">{subjectEmoji(report.mostWorkedSubject)}</p>
              <p className="text-sm font-black text-primary-700">{report.mostWorkedSubject}</p>
            </div>
          )}
          {report.bestSubject && (
            <div className="bg-green-50 rounded-3xl p-4">
              <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wide mb-2">Meilleure</p>
              <p className="text-3xl mb-1">{subjectEmoji(report.bestSubject)}</p>
              <p className="text-sm font-black text-green-700">{report.bestSubject}</p>
            </div>
          )}
        </div>
      )}

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <div className="bg-green-50 rounded-3xl border border-green-100 p-4">
          <p className="font-bold text-sm text-green-700 mb-3">✅ Points forts de la semaine</p>
          <div className="flex flex-wrap gap-2">
            {report.strengths.map((s, i) => (
              <span key={i} className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full border border-green-200">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weaknesses */}
      {report.weaknesses.length > 0 && (
        <div className="bg-orange-50 rounded-3xl border border-orange-100 p-4">
          <p className="font-bold text-sm text-orange-700 mb-3">📌 À retravailler cette semaine</p>
          <div className="flex flex-wrap gap-2">
            {report.weaknesses.map((s, i) => (
              <span key={i} className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full border border-orange-200">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Léna's recommendation */}
      <div
        className="rounded-3xl p-5 text-white"
        style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🤖</span>
          <p className="font-black text-sm">Recommandation de Léna</p>
        </div>
        <p className="text-sm leading-relaxed opacity-95">{report.recommendation}</p>
      </div>
    </div>
  )
}

// ─── Past report list item ────────────────────────────────────────────────────

function PastReportItem({ report, onSelect }: { report: WeeklyReport; onSelect: () => void }) {
  const ringColor =
    report.totalCorrections === 0 ? 'bg-gray-300' :
    report.averageScore >= 15 ? 'bg-green-500' :
    report.averageScore >= 10 ? 'bg-amber-500' :
    'bg-red-400'

  return (
    <button
      onClick={onSelect}
      className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 btn-press text-left"
    >
      <div className={`w-10 h-10 rounded-full ${ringColor} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
        {report.totalCorrections > 0 ? report.averageScore : '–'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1F2937]">{formatWeekRange(report.weekStart, report.weekEnd)}</p>
        <p className="text-xs text-gray-400 font-medium">
          {report.totalCorrections} exercice{report.totalCorrections !== 1 ? 's' : ''}
          {report.totalCorrections > 0 ? ` · moy. ${report.averageScore}/20` : ''}
        </p>
      </div>
      <span className="text-gray-300 text-lg flex-shrink-0">›</span>
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function GenerateCTA({
  hwCount,
  generating,
  onGenerate,
}: {
  hwCount: number
  generating: boolean
  onGenerate: () => void
}) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 text-center">
      <div className="text-5xl mb-3">📋</div>
      <h3 className="font-black text-lg text-[#1F2937] mb-2">Rapport de la semaine</h3>
      <p className="text-sm text-[#8E8E93] mb-5 leading-snug">
        {hwCount === 0
          ? "Aucun exercice cette semaine. Commencez à corriger des devoirs !"
          : `${hwCount} exercice${hwCount > 1 ? 's' : ''} prêt${hwCount > 1 ? 's' : ''} à analyser.`}
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="text-white font-bold px-6 py-3 rounded-2xl btn-press disabled:opacity-60 inline-flex items-center gap-2"
        style={{ background: generating ? '#A78BFA' : 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }}
      >
        {generating ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Génération…
          </>
        ) : '✨ Générer le rapport'}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null)
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [currentReport, setCurrentReport] = useState<WeeklyReport | null>(null)
  const [pastReports, setPastReports] = useState<WeeklyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)
  const [hwRecords, setHwRecords] = useState<HomeworkRecord[]>([])
  const [generating, setGenerating] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const loadForChild = useCallback((child: ChildProfile) => {
    const hw = getAllHomework(child.id)
    setHwRecords(hw)
    const reports = getWeeklyReports(child.id)
    // Most recent report is "current"; the rest are past
    const [first, ...rest] = reports
    setCurrentReport(first ?? null)
    setPastReports(rest)
    setSelectedReport(null)
  }, [])

  useEffect(() => {
    const child = getOrCreateActiveChild()
    setActiveChild(child)
    setChildren(getChildren())
    loadForChild(child)
    setLoaded(true)
  }, [loadForChild])

  function handleSwitchChild(child: ChildProfile) {
    setActiveChildId(child.id)
    setActiveChild(child)
    loadForChild(child)
  }

  function handleGenerate() {
    if (!activeChild || generating) return
    setGenerating(true)
    // Small delay for UX feel
    setTimeout(() => {
      const report = generateWeeklyReport(activeChild.id)
      saveWeeklyReport(report)
      // Reload from storage to get consistent state
      const reports = getWeeklyReports(activeChild.id)
      const [first, ...rest] = reports
      setCurrentReport(first ?? null)
      setPastReports(rest)
      setSelectedReport(null)
      setGenerating(false)
    }, 700)
  }

  const displayReport = selectedReport ?? null

  return (
    <div className="min-h-screen bg-[#F9FAF8] max-w-md mx-auto flex flex-col pb-24">
      <div className="h-12" />

      {/* Header */}
      <div className="px-6 pt-4 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-black text-[#1F2937]">
            {activeChild ? `${activeChild.emoji} ${activeChild.name}` : '📋 Rapports'}
          </h2>
          {activeChild?.level && (
            <span className="text-xs font-black text-white bg-primary-500 px-2 py-0.5 rounded-lg">
              {activeChild.level}
            </span>
          )}
        </div>
        <p className="text-sm text-[#8E8E93] font-medium">Bilan hebdomadaire</p>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="px-6 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => handleSwitchChild(child)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all btn-press ${
                  activeChild?.id === child.id
                    ? 'text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
                style={activeChild?.id === child.id
                  ? { background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)' }
                  : undefined}
              >
                <span>{child.emoji}</span>
                <span>{child.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 flex flex-col gap-5">
        {!loaded ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 7-day timeline */}
            {hwRecords.length > 0 && !displayReport && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">7 derniers jours</p>
                <WeekTimeline records={hwRecords} showScore={true} />
              </div>
            )}

            {/* Selected past report */}
            {displayReport ? (
              <>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="flex items-center gap-1.5 text-primary-500 font-bold text-sm btn-press"
                >
                  ← Retour
                </button>
                <ReportCard report={displayReport} />
              </>
            ) : currentReport ? (
              <>
                <ReportCard report={currentReport} />
                {/* Regenerate */}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full py-3 rounded-2xl border-2 border-primary-200 text-primary-500 font-bold text-sm btn-press disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
                      Génération…
                    </>
                  ) : '🔄 Actualiser le rapport'}
                </button>
              </>
            ) : (
              <GenerateCTA
                hwCount={hwRecords.length}
                generating={generating}
                onGenerate={handleGenerate}
              />
            )}

            {/* Past reports */}
            {pastReports.length > 0 && !displayReport && (
              <div>
                <p className="text-sm font-black text-[#1F2937] mb-3">Rapports précédents</p>
                <div className="flex flex-col gap-2">
                  {pastReports.map(r => (
                    <PastReportItem
                      key={r.id}
                      report={r}
                      onSelect={() => setSelectedReport(r)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
