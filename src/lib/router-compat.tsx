"use client";

import React, {
  createContext,
  forwardRef,
  useContext,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import NextLink from "next/link";
import { notFound as nextNotFound, redirect as nextRedirect } from "next/navigation";
import { usePathname, useRouter as useNextRouter, useSearchParams } from "next/navigation";

type Params = Record<string, string | number | undefined>;
type Search = Record<string, unknown>;

function interpolate(path: string, params?: Params) {
  return Object.entries(params ?? {}).reduce(
    (result, [key, value]) => result.replace(`$${key}`, encodeURIComponent(String(value ?? ""))),
    path,
  );
}

function makeHref(to = "/", params?: Params, search?: Search | ((old: Search) => Search)) {
  const path = interpolate(to.replace(/\/$/, "") || "/", params);
  const values = typeof search === "function" ? search({}) : search;
  if (!values) return path;
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return query.size ? `${path}?${query}` : path;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to?: string;
  params?: Params;
  search?: Search | ((old: Search) => Search);
  children?: ReactNode;
  activeProps?: { className?: string };
  replace?: boolean;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, params, search, children, activeProps, replace, className, ...props },
  ref,
) {
  const pathname = usePathname();
  const href = makeHref(to, params, search);
  const active = pathname === href.split("?")[0];
  return (
    <NextLink
      ref={ref}
      href={href}
      replace={replace}
      className={[className, active ? activeProps?.className : undefined].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </NextLink>
  );
});

export function useNavigate() {
  const router = useNextRouter();
  return async ({ to, params, search, replace }: LinkProps = {}) => {
    const href = makeHref(to, params, search);
    if (replace) router.replace(href);
    else router.push(href);
  };
}

export function useRouter() {
  const router = useNextRouter();
  return {
    invalidate: async () => router.refresh(),
    navigate: useNavigate(),
  };
}

export function useRouterState<T>({
  select,
}: {
  select: (state: { location: { pathname: string } }) => T;
}): T {
  return select({ location: { pathname: usePathname() } });
}

export function useSearch<T = Search>(_options?: unknown): T {
  const params = useSearchParams();
  return Object.fromEntries(params.entries()) as T;
}

export function Navigate(props: LinkProps) {
  React.useEffect(() => {
    window.location.replace(makeHref(props.to, props.params, props.search));
  }, [props.params, props.search, props.to]);
  return null;
}

const OutletContext = createContext<ReactNode>(null);

export function RouterOutletProvider({
  children,
  outlet,
}: {
  children: ReactNode;
  outlet: ReactNode;
}) {
  return <OutletContext.Provider value={outlet}>{children}</OutletContext.Provider>;
}

export function Outlet({ children }: { children?: ReactNode }) {
  const outlet = useContext(OutletContext);
  return children ?? outlet;
}

export function redirect({
  to,
  href,
}: {
  to?: string;
  href?: string;
  [key: string]: unknown;
}): never {
  nextRedirect(href ?? to ?? "/");
}

export function notFound(): never {
  nextNotFound();
}

export function createFileRoute<TPath extends string>(_path: TPath) {
  return (config: {
    component?: React.ComponentType<any>;
    errorComponent?: (props: any) => ReactNode;
    notFoundComponent?: (props: any) => ReactNode;
    beforeLoad?: (context: any) => any;
    loader?: (context: any) => any;
    head?: (context: any) => any;
    validateSearch?: (search: any) => any;
    [key: string]: any;
  }) => ({
    ...config,
    options: config,
    useParams: () => useRouteParams(_path),
    useSearch: (): any => useSearchParamsObject(),
    useRouteContext: () => ({}),
  });
}

function useRouteParams(routePath: string): Record<string, string> {
  const pathname = usePathname();
  const routeParts = routePath.split("/").filter((part) => part && !part.startsWith("_"));
  const pathParts = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  routeParts.forEach((part, index) => {
    if (part.startsWith("$")) params[part.slice(1)] = pathParts[index] ?? "";
  });
  return params;
}

export function createRootRouteWithContext<T>() {
  return () => createFileRoute("/");
}

export function createRouter(config: unknown) {
  return config;
}

export function HeadContent() {
  return null;
}
export function Scripts() {
  return null;
}

function useSearchParamsObject() {
  const params = useSearchParams();
  return Object.fromEntries(params.entries());
}
