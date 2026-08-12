"use client";

import { createFileRoute } from "@tanstack/react-router";
import { AccessDenied } from "@/components/access-denied";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/hotel-list")({
  head: () => ({
    meta: [
      { title: i18n.t("errors.accessDenied.metaTitle") },
      {
        name: "description",
        content: i18n.t("errors.accessDenied.hotelDirectoryDescription"),
      },
    ],
  }),
  component: HotelListAccessDenied,
});

export function HotelListAccessDenied() {
  return <AccessDenied />;
}
