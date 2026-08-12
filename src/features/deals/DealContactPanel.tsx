import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getDealContactState,
  getSafeEmailHref,
  getSafePhoneHref,
  getSafeWhatsAppHref,
} from "@/features/deals/deal-contact-model";
import {
  dealContactQueryKey,
  loadDealCounterpartyContact,
} from "@/features/deals/deal-contact-service";
import {
  classifyDealWorkspaceError,
  type DealWorkspaceSnapshot,
} from "@/features/deals/deal-workspace-model";
import { useAuth } from "@/hooks/use-auth";

type ContactField = "email" | "phone" | "whatsapp";

export function DealContactPanel({ snapshot }: { snapshot: DealWorkspaceSnapshot }) {
  const { t } = useTranslation("deals");
  const { user } = useAuth();
  const state = getDealContactState(snapshot);
  const [copied, setCopied] = useState<ContactField | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const contactQuery = useQuery({
    queryKey: dealContactQueryKey(snapshot.deal.id, user?.id),
    enabled: state === "revealed" && Boolean(user),
    queryFn: () => loadDealCounterpartyContact(snapshot.deal.id),
    retry: (failureCount, error) =>
      classifyDealWorkspaceError(error) === "network" && failureCount < 1,
    staleTime: 30_000,
  });

  async function copyField(field: ContactField, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setAnnouncement(
        t("workspace.contact.feedback.copied", { field: t(`workspace.contact.${field}`) }),
      );
      window.setTimeout(() => setCopied(null), 2_000);
    } catch {
      setAnnouncement(t("workspace.contact.feedback.copyFailed"));
    }
  }

  if (state !== "revealed") {
    return (
      <ContactShell
        icon={LockKeyhole}
        title={t(`workspace.contact.${state}.title`)}
        description={t(`workspace.contact.${state}.description`)}
      />
    );
  }

  if (contactQuery.isLoading) {
    return (
      <section
        className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">{t("workspace.contact.loading")}</span>
        <div className="h-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </section>
    );
  }

  if (contactQuery.error || !contactQuery.data) {
    const kind = contactQuery.error
      ? classifyDealWorkspaceError(contactQuery.error)
      : "state_changed";
    return (
      <ContactShell
        icon={LockKeyhole}
        title={t("workspace.contact.error.title")}
        description={t(`workspace.contact.error.${kind}`)}
        actionLabel={kind === "network" ? t("workspace.contact.retry") : undefined}
        onAction={kind === "network" ? () => contactQuery.refetch() : undefined}
      />
    );
  }

  const contact = contactQuery.data;
  const contactRows = [contact.email, contact.phone, contact.whatsapp, contact.address].filter(
    Boolean,
  );

  return (
    <section
      className="rounded-lg border border-success/30 bg-card p-5 shadow-sm"
      aria-labelledby="deal-contact-title"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-success/10 text-success">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="deal-contact-title" className="font-semibold text-foreground">
            {t("workspace.contact.revealed.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("workspace.contact.revealed.description")}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {contact.business_name}
        </p>
        {contact.contact_name ? (
          <p className="mt-1 text-sm text-muted-foreground">{contact.contact_name}</p>
        ) : null}

        {contactRows.length > 0 ? (
          <dl className="mt-4 space-y-3">
            {contact.email ? (
              <ContactRow
                icon={Mail}
                label={t("workspace.contact.email")}
                value={contact.email}
                href={getSafeEmailHref(contact.email)}
                externalLabel={t("workspace.contact.actions.email")}
                copied={copied === "email"}
                onCopy={() => copyField("email", contact.email!)}
              />
            ) : null}
            {contact.phone ? (
              <ContactRow
                icon={Phone}
                label={t("workspace.contact.phone")}
                value={contact.phone}
                href={getSafePhoneHref(contact.phone)}
                externalLabel={t("workspace.contact.actions.call")}
                copied={copied === "phone"}
                onCopy={() => copyField("phone", contact.phone!)}
              />
            ) : null}
            {contact.whatsapp ? (
              <ContactRow
                icon={MessageCircle}
                label={t("workspace.contact.whatsapp")}
                value={contact.whatsapp}
                href={getSafeWhatsAppHref(contact.whatsapp)}
                externalLabel={t("workspace.contact.actions.whatsapp")}
                copied={copied === "whatsapp"}
                onCopy={() => copyField("whatsapp", contact.whatsapp!)}
                openNew
              />
            ) : null}
            {contact.address ? (
              <div className="flex items-start gap-3">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    {t("workspace.contact.address")}
                  </dt>
                  <dd className="mt-0.5 break-words text-sm font-medium text-foreground">
                    {contact.address}
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t("workspace.contact.noFields")}</p>
        )}
      </div>
    </section>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  externalLabel,
  copied,
  onCopy,
  openNew = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href: string | null;
  externalLabel: string;
  copied: boolean;
  onCopy: () => void;
  openNew?: boolean;
}) {
  const { t } = useTranslation("deals");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-medium text-foreground" title={value}>
          <bdi dir="ltr">{value}</bdi>
        </dd>
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="flex shrink-0 gap-1">
          <IconAction
            label={t("workspace.contact.actions.copy", { field: label })}
            onClick={onCopy}
            icon={copied ? Check : Copy}
          />
          {href ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="icon" variant="ghost" className="h-11 w-11">
                  <a
                    href={href}
                    aria-label={externalLabel}
                    target={openNew ? "_blank" : undefined}
                    rel={openNew ? "noreferrer" : undefined}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{externalLabel}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </TooltipProvider>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Copy;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-11 w-11"
          aria-label={label}
          onClick={onClick}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ContactShell({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof LockKeyhole;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section
      className="rounded-lg border border-primary/15 bg-primary/5 p-5"
      aria-labelledby="deal-contact-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-background text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="deal-contact-title" className="font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          {actionLabel && onAction ? (
            <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
