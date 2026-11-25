const TIME_ZONE = "America/Sao_Paulo";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** Datas sem hora (ocorrência e divulgação de um vazamento) são gravadas à meia-noite UTC. */
const calendarDateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Data sem hora, sem conversão de fuso: "02/09/2025". */
export function formatCalendarDate(iso: string): string {
  return calendarDateFormat.format(new Date(iso));
}

/** Mês de uma data sem hora: "out. de 2026". */
export function formatMonth(iso: string): string {
  return monthFormat.format(new Date(iso));
}

/** "23/11/2026 às 15:30" */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso)).replace(", ", " às ");
}

/**
 * Tempo relativo a um instante de referência ("há 3 h", "há 2 dias"). A referência vem da API
 * (`generatedAt`), para a página não depender do relógio de quem renderiza.
 */
export function formatRelative(iso: string, reference: string): string {
  const minutes = Math.max(0, Math.round((new Date(reference).getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return formatDate(iso);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
