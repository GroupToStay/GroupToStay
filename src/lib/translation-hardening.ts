import {
  getHtmlLang,
  getTextDirection,
  normalizeAppLanguage,
  type AppLanguage,
} from "@/lib/locale";

const DOM_RECOVERY_PATCH = Symbol.for("gts.googleTranslateDomRecovery");
const PORTAL_ROOT_ID = "gts-notranslate-portal-root";

type PatchedNodePrototype = Node & {
  [DOM_RECOVERY_PATCH]?: boolean;
};

type ParentNodeWithMutationMethods = Node & {
  appendChild<T extends Node>(node: T): T;
  insertBefore<T extends Node>(node: T, child: Node | null): T;
  removeChild<T extends Node>(child: T): T;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function noTranslateClassName(className?: string) {
  return className ? `notranslate ${className}` : "notranslate";
}

export function noTranslateAttributes() {
  return {
    translate: "no" as const,
    className: "notranslate",
  };
}

export function applyNoTranslateAttributes(language: AppLanguage | string = "en") {
  if (!isBrowser()) return;

  const normalized = normalizeAppLanguage(language);
  document.documentElement.lang = getHtmlLang(normalized);
  document.documentElement.dir = getTextDirection(normalized);
  document.documentElement.setAttribute("translate", "no");
  document.documentElement.classList.add("notranslate");

  document.body?.setAttribute("translate", "no");
  document.body?.classList.add("notranslate");
  getNoTranslatePortalContainer();
}

export function getNoTranslatePortalContainer(): HTMLElement | undefined {
  if (!isBrowser()) return undefined;

  let portalRoot = document.getElementById(PORTAL_ROOT_ID);
  if (!portalRoot) {
    portalRoot = document.createElement("div");
    portalRoot.id = PORTAL_ROOT_ID;
    portalRoot.dataset.gtsPortalRoot = "true";
    portalRoot.className = "notranslate";
    portalRoot.setAttribute("translate", "no");
    document.body.appendChild(portalRoot);
  }

  portalRoot.classList.add("notranslate");
  portalRoot.setAttribute("translate", "no");
  return portalRoot;
}

export function isExternalDomMutationError(error: unknown) {
  if (!error) return false;

  const name =
    typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name) : "";
  const message =
    typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  const stack =
    typeof error === "object" && "stack" in error
      ? String((error as { stack?: unknown }).stack)
      : "";
  const combined = `${name} ${message} ${stack}`;

  return (
    /NotFoundError|HierarchyRequestError/i.test(combined) ||
    /removeChild|insertBefore|replaceChild/i.test(combined) ||
    /node to be removed is not a child|node before which the new node is to be inserted/i.test(
      combined,
    )
  );
}

export function installExternalDomMutationRecovery() {
  if (!isBrowser() || typeof Node === "undefined") return;

  const nodePrototype = Node.prototype as PatchedNodePrototype;
  if (nodePrototype[DOM_RECOVERY_PATCH]) return;

  const originalRemoveChild = nodePrototype.removeChild;
  const originalInsertBefore = nodePrototype.insertBefore;
  const originalAppendChild = nodePrototype.appendChild;

  nodePrototype.removeChild = function removeChild<T extends Node>(this: Node, child: T): T {
    const parent = this as ParentNodeWithMutationMethods;
    if (child?.parentNode && child.parentNode !== this) {
      return child;
    }

    try {
      return originalRemoveChild.call(parent, child) as T;
    } catch (error) {
      if (isExternalDomMutationError(error)) return child;
      throw error;
    }
  };

  nodePrototype.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    const parent = this as ParentNodeWithMutationMethods;
    if (referenceNode && referenceNode.parentNode !== this) {
      return originalAppendChild.call(parent, newNode) as T;
    }

    try {
      return originalInsertBefore.call(parent, newNode, referenceNode) as T;
    } catch (error) {
      if (isExternalDomMutationError(error)) {
        return originalAppendChild.call(parent, newNode) as T;
      }
      throw error;
    }
  };

  nodePrototype[DOM_RECOVERY_PATCH] = true;
}

export function installNoTranslateAttributeGuard(getLanguage: () => AppLanguage | string) {
  if (!isBrowser() || typeof MutationObserver === "undefined") {
    return () => undefined;
  }

  applyNoTranslateAttributes(getLanguage());

  let restoring = false;
  const restore = () => {
    if (restoring) return;
    restoring = true;
    window.requestAnimationFrame(() => {
      applyNoTranslateAttributes(getLanguage());
      restoring = false;
    });
  };

  const observer = new MutationObserver((mutations) => {
    if (
      mutations.some(
        (mutation) =>
          mutation.type === "attributes" &&
          (mutation.attributeName === "lang" ||
            mutation.attributeName === "dir" ||
            mutation.attributeName === "translate" ||
            mutation.attributeName === "class"),
      )
    ) {
      restore();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang", "dir", "translate", "class"],
  });

  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["translate", "class"],
    });
  }

  return () => observer.disconnect();
}
