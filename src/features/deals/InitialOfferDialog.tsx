import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InitialOfferInput } from "@/features/deals/deal-workspace-service";

export function InitialOfferDialog({
  dealId,
  defaultCurrency,
  pending,
  onSubmit,
}: {
  dealId: string;
  defaultCurrency: string;
  pending: boolean;
  onSubmit: (input: InitialOfferInput) => Promise<boolean>;
}) {
  const { t } = useTranslation("deals");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency.toUpperCase());
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  function changeOpen(next: boolean) {
    if (!pending) setOpen(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsedAmount = Number(amount);
    const normalizedCurrency = currency.trim().toUpperCase();
    const parsedValidity = validUntil ? new Date(validUntil) : null;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(t("workspace.initialOffer.errors.amount"));
      return;
    }
    if (!/^[A-Z]{3}$/u.test(normalizedCurrency)) {
      setFormError(t("workspace.initialOffer.errors.currency"));
      return;
    }
    if (
      parsedValidity &&
      (!Number.isFinite(parsedValidity.getTime()) || parsedValidity <= new Date())
    ) {
      setFormError(t("workspace.initialOffer.errors.validity"));
      return;
    }
    if (notes.trim().length > 5000) {
      setFormError(t("workspace.initialOffer.errors.notes"));
      return;
    }

    setFormError("");
    const succeeded = await onSubmit({
      dealId,
      amount: parsedAmount,
      currency: normalizedCurrency,
      validUntil: parsedValidity?.toISOString() ?? null,
      notes: notes.trim() || null,
      requestId,
    });
    if (succeeded) {
      setRequestId(crypto.randomUUID());
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="gold" className="min-h-11" disabled={pending}>
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          {t("workspace.initialOffer.action")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("workspace.initialOffer.title")}</DialogTitle>
            <DialogDescription>{t("workspace.initialOffer.description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="initial-offer-amount">{t("workspace.initialOffer.amount")}</Label>
                <Input
                  id="initial-offer-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={pending}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial-offer-currency">
                  {t("workspace.initialOffer.currency")}
                </Label>
                <Input
                  id="initial-offer-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  maxLength={3}
                  autoCapitalize="characters"
                  dir="ltr"
                  disabled={pending}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial-offer-validity">
                {t("workspace.initialOffer.validUntil")}
              </Label>
              <Input
                id="initial-offer-validity"
                type="datetime-local"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                disabled={pending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial-offer-notes">{t("workspace.initialOffer.notes")}</Label>
              <Textarea
                id="initial-offer-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={5000}
                rows={4}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                {t("workspace.initialOffer.immutableNotice")}
              </p>
            </div>

            {formError ? (
              <p className="text-sm font-medium text-error" role="alert">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11" disabled={pending}>
                {t("workspace.actions.keepReviewing")}
              </Button>
            </DialogClose>
            <Button type="submit" variant="gold" className="min-h-11" disabled={pending}>
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              {pending ? t("workspace.actions.processing") : t("workspace.initialOffer.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
