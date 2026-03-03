import { useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { WeeklyChart } from "@/components/WeeklyChart";
import { PersonTable } from "@/components/PersonTable";
import { PersonSummary } from "@/components/PersonSummary";
import { dailyData, monthlyGoals, getMonthTotals, METRIC_LABELS, PEOPLE } from "@/data/prospecting-data";
import { Users, Link, Mail, Phone, Calendar, MessageSquare, Target, UserCheck, PhoneCall, CalendarCheck } from "lucide-react";

const KPI_ICONS: Record<string, React.ReactNode> = {
  conexoes: <Link size={16} />,
  conexoesAceitas: <UserCheck size={16} />,
  abordagens: <MessageSquare size={16} />,
  inmail: <Mail size={16} />,
  followUp: <Target size={16} />,
  numero: <Phone size={16} />,
  ligAgendada: <PhoneCall size={16} />,
  ligRealizada: <PhoneCall size={16} />,
  reuniaoAgendada: <Calendar size={16} />,
  reuniaoRealizada: <CalendarCheck size={16} />,
};

const METRICS = ["conexoes", "conexoesAceitas", "abordagens", "inmail", "followUp", "numero", "ligAgendada", "ligRealizada", "reuniaoAgendada", "reuniaoRealizada"] as const;

const CHART_METRICS = ["followUp", "conexoes", "reuniaoRealizada", "ligRealizada"] as const;

export default function Index() {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<string>("followUp");
  const totals = getMonthTotals(dailyData, selectedPerson ?? undefined);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Prospecção — Março 2026</h1>
          <p className="text-xs text-muted-foreground">Dashboard de métricas de prospecção</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedPerson(null)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              !selectedPerson ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Todos
          </button>
          {PEOPLE.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPerson(p)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                selectedPerson === p ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {METRICS.map(m => (
            <KpiCard
              key={m}
              label={METRIC_LABELS[m]}
              value={(totals as any)[m]}
              goal={(monthlyGoals as any)[m]}
              icon={KPI_ICONS[m]}
            />
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-card-foreground">Meta vs Realizado — Semanal</h3>
              <div className="flex gap-1 ml-auto">
                {CHART_METRICS.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedChart(m)}
                    className={`px-2 py-1 text-[10px] rounded-md font-medium transition-colors ${
                      selectedChart === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-card-foreground"
                    }`}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <WeeklyChart metric={selectedChart} />
          </div>
          <PersonSummary />
        </div>

        {/* Table */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Detalhamento Diário {selectedPerson && `— ${selectedPerson}`}
          </h3>
          <PersonTable selectedPerson={selectedPerson} />
        </div>
      </main>
    </div>
  );
}
