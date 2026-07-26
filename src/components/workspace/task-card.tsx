import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceTask = {
  id: string;
  title: string;
  description: string;
  count?: number;
  to: string;
  icon: LucideIcon;
  tone?: "primary" | "info" | "warning" | "success" | "error";
};

const tones = {
  primary: "bg-primary/8 text-primary",
  info: "bg-info/10 text-info",
  warning: "bg-warning/12 text-warning",
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
};

export function TaskCard({ task }: { task: WorkspaceTask }) {
  const Icon = task.icon;
  return (
    <Link
      to={task.to as any}
      className="group flex min-h-24 items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/20"
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-md",
          tones[task.tone ?? "primary"],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{task.title}</span>
          {typeof task.count === "number" ? (
            <span className="inline-grid min-w-6 place-items-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-bold text-foreground">
              {task.count}
            </span>
          ) : null}
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {task.description}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </Link>
  );
}

export function TaskGrid({ tasks }: { tasks: WorkspaceTask[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
