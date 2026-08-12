import type { Metadata } from "next";
import { ChatPage as RoutePage } from "@/routes/_authenticated/dashboard.messages.$id";

export const metadata: Metadata = { title: "Conversation" };

export default function Page() {
  return <RoutePage />;
}
