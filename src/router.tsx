import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";
import "./lib/fonts";
import i18n from "./lib/i18n";
import {
  getAppLanguageFromCookieHeader,
  getCookieAppLanguage,
  normalizeAppLanguage,
} from "./lib/locale";

const getInitialLanguage = createIsomorphicFn()
  .server(() =>
    normalizeAppLanguage(getAppLanguageFromCookieHeader(getRequest().headers.get("cookie"))),
  )
  .client(() => getCookieAppLanguage() ?? "en");

export const getRouter = async () => {
  const appLanguage = getInitialLanguage();
  await i18n.changeLanguage(appLanguage);

  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, appLanguage },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
