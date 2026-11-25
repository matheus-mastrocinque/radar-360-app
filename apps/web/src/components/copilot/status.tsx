import { AlertTriangle, CheckCircle2, Hourglass, Info, Mail, type LucideIcon } from "lucide-react";
import type { LgpdStatus } from "@/lib/incidents";
import { cn } from "@/lib/utils";

/** Estados do design system: sempre ícone + palavra, chapados (sem brilho). O carmesim nunca indica estado. */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const BADGE_TONE: Record<Tone, string> = {
  success: "bg-success/15 text-success ring-success/30",
  warning: "bg-warning/15 text-warning ring-warning/30",
  danger: "bg-danger/15 text-danger ring-danger/30",
  info: "bg-info/15 text-info ring-info/30",
  neutral: "bg-muted text-muted-foreground ring-white/10",
};

const ALERT_TONE: Record<Exclude<Tone, "neutral">, { box: string; icon: string; Icon: LucideIcon }> = {
  success: { box: "bg-success/10 ring-success/30", icon: "text-success", Icon: CheckCircle2 },
  warning: { box: "bg-warning/10 ring-warning/35", icon: "text-warning", Icon: AlertTriangle },
  danger: { box: "bg-danger/10 ring-danger/35", icon: "text-danger", Icon: AlertTriangle },
  info: { box: "bg-info/10 ring-info/30", icon: "text-info", Icon: Info },
};

export function StateBadge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-px font-mono text-[11px] font-medium tracking-wider whitespace-nowrap uppercase ring-1",
        BADGE_TONE[tone],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** Faixa de estado (receita do design system). `label` é a palavra que acompanha o ícone. */
export function StateAlert({
  tone,
  label,
  icon,
  children,
  role,
  className,
}: {
  tone: Exclude<Tone, "neutral">;
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  role?: "alert" | "status";
  className?: string;
}) {
  const style = ALERT_TONE[tone];
  const Icon = icon ?? style.Icon;
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-lg px-3.5 py-3 text-sm leading-relaxed text-foreground ring-1",
        style.box,
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.icon)} aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-2">
        <span className={cn("shrink-0 font-semibold", style.icon)}>{label}</span>
        <span className="min-w-0">{children}</span>
      </div>
    </div>
  );
}

export const LGPD_STATUS: Record<LgpdStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  not_sent: { tone: "neutral", icon: Mail, label: "LGPD · a enviar" },
  waiting: { tone: "warning", icon: Hourglass, label: "LGPD · prazo correndo" },
  overdue: { tone: "danger", icon: AlertTriangle, label: "LGPD · prazo vencido" },
  answered: { tone: "success", icon: CheckCircle2, label: "LGPD · respondida" },
};

export function LgpdBadge({ status, className }: { status: LgpdStatus; className?: string }) {
  const meta = LGPD_STATUS[status];
  return (
    <StateBadge tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </StateBadge>
  );
}
