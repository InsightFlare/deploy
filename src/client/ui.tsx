import { useState, type ReactNode } from "react";
import { RiAlertLine, RiCheckLine, RiFileCopyLine, RiInformationLine, RiShieldCheckLine } from "@remixicon/react";
import { Button } from "@insightflare/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTrigger,
  AlertDialogAction, AlertDialogCancel, AlertDialogTitle, AlertDialogDescription
} from "@insightflare/ui/alert-dialog";
import { pageMessages } from "./locale-route";
import { formatI18nTemplate } from "../lib/i18n/template";
import type { DeployMessageKey } from "../lib/i18n/messages";
import { ApiError } from "./api";

export type Translate = (key: DeployMessageKey, params?: Record<string, string | number>) => string;

export function useI18n() {
  const { locale, messages, hrefForLocale } = pageMessages();
  const t: Translate = (key, params) => formatI18nTemplate(messages.deploy[key], params ?? {});
  /** Optional dynamic keys such as note_<CODE>; returns null when there is no translation. */
  const tMaybe = (key: string, params?: Record<string, string | number>): string | null => {
    const template = (messages.deploy as Record<string, string>)[key];
    return template ? formatI18nTemplate(template, params ?? {}) : null;
  };
  return { locale, t, tMaybe, hrefForLocale };
}

export function errorText(t: Translate, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;
    if (error.status) return t("httpError", { status: error.status });
  }
  return t("unexpectedError");
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{children}</p>;
}

const NOTICE_TONES = {
  info: { icon: RiInformationLine, className: "border-border bg-muted/15", iconClass: "text-primary" },
  success: { icon: RiShieldCheckLine, className: "border-border bg-muted/15", iconClass: "text-primary" },
  warning: { icon: RiAlertLine, className: "border-amber-500/40 bg-amber-500/5", iconClass: "text-amber-600 dark:text-amber-400" },
  error: { icon: RiAlertLine, className: "border-destructive/30 bg-destructive/5", iconClass: "text-destructive" }
} as const;

export function Notice({ tone = "info", title, children, action }: {
  tone?: keyof typeof NOTICE_TONES; title?: ReactNode; children?: ReactNode; action?: ReactNode;
}) {
  const style = NOTICE_TONES[tone];
  const Icon = style.icon;
  return <div role={tone === "error" ? "alert" : undefined} className={"flex items-start gap-3 rounded-none border p-4 " + style.className}>
    <Icon className={"mt-0.5 size-4 shrink-0 " + style.iconClass} />
    <div className="min-w-0 flex-1 space-y-1">
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      {children ? <div className="break-words text-xs leading-5 text-muted-foreground">{children}</div> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  </div>;
}

export function ConfirmOperation({ children, title, description, confirmText, cancelText, onConfirm, destructive = false }: {
  children: ReactNode; title: string; description: string; confirmText: string; cancelText: string;
  onConfirm: () => void; destructive?: boolean;
}) {
  return <AlertDialog>
    <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle icon={destructive ? RiAlertLine : RiShieldCheckLine}>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{cancelText}</AlertDialogCancel>
        <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirmText}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

/** Monospace value with a copy button. */
export function CopyValue({ label, value, t }: { label: string; value: string; t: Translate }) {
  const [copied, setCopied] = useState(false);
  return <div className="space-y-1.5">
    <Eyebrow>{label}</Eyebrow>
    <div className="flex items-stretch gap-2">
      <code className="deploy-mono flex min-w-0 flex-1 items-center border border-border bg-muted/20 px-3 py-2 text-sm">{value}</code>
      <Button variant="outline" onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}>
        {copied ? <RiCheckLine data-icon="inline-start" /> : <RiFileCopyLine data-icon="inline-start" />}
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  </div>;
}

export const shortSha = (sha: string | null | undefined) => sha ? sha.slice(0, 8) : "";
