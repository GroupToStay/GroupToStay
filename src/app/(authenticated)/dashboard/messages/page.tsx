import type { Metadata } from "next";
import { MessagesIndex as RoutePage } from "@/routes/_authenticated/dashboard.messages.index";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return <RoutePage />;
}
