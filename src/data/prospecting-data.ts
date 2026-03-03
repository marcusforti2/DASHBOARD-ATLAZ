export interface DailyEntry {
  date: string;
  dayOfWeek: string;
  person: string;
  conexoes: number;
  conexoesAceitas: number;
  abordagens: number;
  inmail: number;
  followUp: number;
  numero: number;
  ligAgendada: number;
  ligRealizada: number;
  reuniaoAgendada: number;
  reuniaoRealizada: number;
}

export interface WeeklyGoal {
  week: number;
  conexoes: number;
  conexoesAceitas: number;
  abordagens: number;
  inmail: number;
  followUp: number;
  numero: number;
  ligAgendada: number;
  ligRealizada: number;
  reuniaoAgendada: number;
  reuniaoRealizada: number;
}

export interface MonthlyGoal {
  conexoes: number;
  conexoesAceitas: number;
  abordagens: number;
  inmail: number;
  followUp: number;
  numero: number;
  ligAgendada: number;
  ligRealizada: number;
  reuniaoAgendada: number;
  reuniaoRealizada: number;
}

export const METRIC_LABELS: Record<string, string> = {
  conexoes: "Conexões",
  conexoesAceitas: "Conexões Aceitas",
  abordagens: "Abordagens",
  inmail: "InMail",
  followUp: "Follow Up",
  numero: "Número",
  ligAgendada: "Lig. Agendada",
  ligRealizada: "Lig. Realizada",
  reuniaoAgendada: "Reunião Agendada",
  reuniaoRealizada: "Reunião Realizada",
};

export const weeklyGoals: WeeklyGoal[] = [
  { week: 1, conexoes: 400, conexoesAceitas: 187, abordagens: 187, inmail: 52, followUp: 710, numero: 38, ligAgendada: 53, ligRealizada: 53, reuniaoAgendada: 29, reuniaoRealizada: 29 },
  { week: 2, conexoes: 600, conexoesAceitas: 272, abordagens: 255, inmail: 60, followUp: 1150, numero: 46, ligAgendada: 66, ligRealizada: 66, reuniaoAgendada: 36, reuniaoRealizada: 36 },
  { week: 3, conexoes: 600, conexoesAceitas: 272, abordagens: 255, inmail: 60, followUp: 1250, numero: 61, ligAgendada: 76, ligRealizada: 76, reuniaoAgendada: 36, reuniaoRealizada: 36 },
  { week: 4, conexoes: 760, conexoesAceitas: 340, abordagens: 323, inmail: 84, followUp: 1870, numero: 101, ligAgendada: 120, ligRealizada: 120, reuniaoAgendada: 56, reuniaoRealizada: 56 },
];

export const monthlyGoals: MonthlyGoal = {
  conexoes: 2360,
  conexoesAceitas: 1071,
  abordagens: 1020,
  inmail: 256,
  followUp: 4980,
  numero: 246,
  ligAgendada: 315,
  ligRealizada: 315,
  reuniaoAgendada: 157,
  reuniaoRealizada: 157,
};

// Weekly actuals from CSV (second column in each metric pair)
export const weeklyActuals = [
  { week: 1, conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 116, numero: 3, ligAgendada: 3, ligRealizada: 7, reuniaoAgendada: 0, reuniaoRealizada: 2 },
  { week: 2, conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  { week: 3, conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  { week: 4, conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
];

export const PEOPLE = ["Alex", "Aline", "Maíza"];

// Daily data parsed from the CSV
export const dailyData: DailyEntry[] = [
  // Week 1
  { date: "01/03", dayOfWeek: "Dom", person: "Alex", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  { date: "01/03", dayOfWeek: "Dom", person: "Aline", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  { date: "01/03", dayOfWeek: "Dom", person: "Maíza", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  
  { date: "02/03", dayOfWeek: "Seg", person: "Alex", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 30, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  { date: "02/03", dayOfWeek: "Seg", person: "Aline", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 100, numero: 4, ligAgendada: 7, ligRealizada: 7, reuniaoAgendada: 4, reuniaoRealizada: 4 },
  { date: "02/03", dayOfWeek: "Seg", person: "Maíza", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  
  { date: "03/03", dayOfWeek: "Ter", person: "Alex", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 3, followUp: 30, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  { date: "03/03", dayOfWeek: "Ter", person: "Aline", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 3, followUp: 100, numero: 4, ligAgendada: 7, ligRealizada: 7, reuniaoAgendada: 4, reuniaoRealizada: 4 },
  { date: "03/03", dayOfWeek: "Ter", person: "Maíza", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 10, followUp: 0, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  
  { date: "04/03", dayOfWeek: "Qua", person: "Alex", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 4, followUp: 30, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  { date: "04/03", dayOfWeek: "Qua", person: "Aline", conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 4, followUp: 100, numero: 4, ligAgendada: 7, ligRealizada: 7, reuniaoAgendada: 4, reuniaoRealizada: 4 },
  { date: "04/03", dayOfWeek: "Qua", person: "Maíza", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 4, followUp: 10, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  
  { date: "05/03", dayOfWeek: "Qui", person: "Alex", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 4, followUp: 30, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  { date: "05/03", dayOfWeek: "Qui", person: "Aline", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 4, followUp: 100, numero: 4, ligAgendada: 7, ligRealizada: 7, reuniaoAgendada: 4, reuniaoRealizada: 4 },
  { date: "05/03", dayOfWeek: "Qui", person: "Maíza", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 4, followUp: 20, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  
  { date: "06/03", dayOfWeek: "Sex", person: "Alex", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 4, followUp: 30, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },
  { date: "06/03", dayOfWeek: "Sex", person: "Aline", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 4, followUp: 100, numero: 4, ligAgendada: 7, ligRealizada: 7, reuniaoAgendada: 4, reuniaoRealizada: 4 },
  { date: "06/03", dayOfWeek: "Sex", person: "Maíza", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 4, followUp: 30, numero: 2, ligAgendada: 2, ligRealizada: 2, reuniaoAgendada: 1, reuniaoRealizada: 1 },

  { date: "07/03", dayOfWeek: "Sab", person: "Alex", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  { date: "07/03", dayOfWeek: "Sab", person: "Aline", conexoes: 40, conexoesAceitas: 17, abordagens: 17, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
  { date: "07/03", dayOfWeek: "Sab", person: "Maíza", conexoes: 0, conexoesAceitas: 17, abordagens: 17, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 },
];

// Helper to get daily totals by date
export function getDailyTotals(data: DailyEntry[], filterPerson?: string) {
  const filtered = filterPerson ? data.filter(d => d.person === filterPerson) : data;
  const byDate = new Map<string, Omit<DailyEntry, 'person'>>();
  
  for (const entry of filtered) {
    const key = entry.date;
    const existing = byDate.get(key);
    if (existing) {
      existing.conexoes += entry.conexoes;
      existing.conexoesAceitas += entry.conexoesAceitas;
      existing.abordagens += entry.abordagens;
      existing.inmail += entry.inmail;
      existing.followUp += entry.followUp;
      existing.numero += entry.numero;
      existing.ligAgendada += entry.ligAgendada;
      existing.ligRealizada += entry.ligRealizada;
      existing.reuniaoAgendada += entry.reuniaoAgendada;
      existing.reuniaoRealizada += entry.reuniaoRealizada;
    } else {
      byDate.set(key, { ...entry });
    }
  }
  
  return Array.from(byDate.values());
}

// Get totals for entire dataset
export function getMonthTotals(data: DailyEntry[], filterPerson?: string) {
  const filtered = filterPerson ? data.filter(d => d.person === filterPerson) : data;
  return filtered.reduce(
    (acc, entry) => ({
      conexoes: acc.conexoes + entry.conexoes,
      conexoesAceitas: acc.conexoesAceitas + entry.conexoesAceitas,
      abordagens: acc.abordagens + entry.abordagens,
      inmail: acc.inmail + entry.inmail,
      followUp: acc.followUp + entry.followUp,
      numero: acc.numero + entry.numero,
      ligAgendada: acc.ligAgendada + entry.ligAgendada,
      ligRealizada: acc.ligRealizada + entry.ligRealizada,
      reuniaoAgendada: acc.reuniaoAgendada + entry.reuniaoAgendada,
      reuniaoRealizada: acc.reuniaoRealizada + entry.reuniaoRealizada,
    }),
    { conexoes: 0, conexoesAceitas: 0, abordagens: 0, inmail: 0, followUp: 0, numero: 0, ligAgendada: 0, ligRealizada: 0, reuniaoAgendada: 0, reuniaoRealizada: 0 }
  );
}

// Get person totals
export function getPersonTotals(data: DailyEntry[]) {
  return PEOPLE.map(person => ({
    person,
    ...getMonthTotals(data, person),
  }));
}
