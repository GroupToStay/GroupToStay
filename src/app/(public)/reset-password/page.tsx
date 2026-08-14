import { createPageMetadata } from "@/lib/seo";
import { Page as RoutePage } from "@/routes/reset-password";

export const metadata = createPageMetadata({
  title: "Reset password",
  description: "Reset the password for your GroupToStay account.",
  path: "/reset-password",
  index: false,
});

export default function Page() {
  return <RoutePage />;
}
