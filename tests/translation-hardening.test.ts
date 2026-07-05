import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeAppLanguage } from "../src/lib/locale";
import {
  applyNoTranslateAttributes,
  getNoTranslatePortalContainer,
  installExternalDomMutationRecovery,
  isExternalDomMutationError,
  noTranslateClassName,
} from "../src/lib/translation-hardening";

class FakeClassList {
  private readonly values = new Set<string>();

  add(...tokens: string[]) {
    tokens.forEach((token) => this.values.add(token));
  }

  contains(token: string) {
    return this.values.has(token);
  }

  toString() {
    return Array.from(this.values).join(" ");
  }
}

class FakeNode {
  parentNode: FakeNode | null = null;
  readonly children: FakeNode[] = [];

  appendChild<T extends FakeNode>(child: T): T {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild<T extends FakeNode>(child: T): T {
    if (child.parentNode !== this) {
      const error = new Error("The node to be removed is not a child of this node.");
      error.name = "NotFoundError";
      throw error;
    }

    child.parentNode = null;
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }

  insertBefore<T extends FakeNode>(newNode: T, referenceNode: FakeNode | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      const error = new Error(
        "The node before which the new node is to be inserted is not a child.",
      );
      error.name = "NotFoundError";
      throw error;
    }

    newNode.parentNode?.removeChild(newNode);
    newNode.parentNode = this;

    const index = referenceNode ? this.children.indexOf(referenceNode) : -1;
    if (index >= 0) {
      this.children.splice(index, 0, newNode);
    } else {
      this.children.push(newNode);
    }

    return newNode;
  }
}

class FakeElement extends FakeNode {
  id = "";
  className = "";
  dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly classList = new FakeClassList();

  constructor(readonly tagName = "div") {
    super();
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}

function findById(node: FakeNode, id: string): FakeElement | null {
  if (node instanceof FakeElement && node.id === id) return node;

  for (const child of node.children) {
    const match = findById(child, id);
    if (match) return match;
  }

  return null;
}

function installFakeBrowser(language = "ar-SA") {
  const documentElement = new FakeElement("html");
  const body = new FakeElement("body");
  const document = {
    body,
    documentElement,
    createElement: (tagName: string) => new FakeElement(tagName),
    getElementById: (id: string) => findById(body, id),
  };

  vi.stubGlobal("Node", FakeNode);
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", {
    navigator: { language, languages: [language] },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });

  return { body, documentElement };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("translation hardening", () => {
  it.each([
    ["en-US", "en"],
    ["en-GB", "en"],
    ["ar", "ar"],
    ["ar-SA", "ar"],
    ["ar-EG", "ar"],
    ["fr", "en"],
    ["de", "en"],
    ["es", "en"],
  ] as const)("normalizes browser locale %s without throwing", (input, expected) => {
    expect(() => normalizeAppLanguage(input)).not.toThrow();
    expect(normalizeAppLanguage(input)).toBe(expected);
  });

  it("keeps app locale independent from browser language and marks the app as notranslate", () => {
    const { body, documentElement } = installFakeBrowser("ar-SA");

    applyNoTranslateAttributes("fr");

    expect(documentElement.lang).toBe("en");
    expect(documentElement.dir).toBe("ltr");
    expect(documentElement.getAttribute("translate")).toBe("no");
    expect(documentElement.classList.contains("notranslate")).toBe(true);
    expect(body.getAttribute("translate")).toBe("no");
    expect(body.classList.contains("notranslate")).toBe(true);
  });

  it("creates one protected portal root for translated popovers, selects and dialogs", () => {
    installFakeBrowser("fr");

    const first = getNoTranslatePortalContainer();
    const second = getNoTranslatePortalContainer();

    expect(first).toBe(second);
    expect(first?.id).toBe("gts-notranslate-portal-root");
    expect(first?.getAttribute("translate")).toBe("no");
    expect(first?.classList.contains("notranslate")).toBe(true);
  });

  it("recovers when Google Translate moves DOM nodes before React removes them", () => {
    installFakeBrowser("ar-EG");
    installExternalDomMutationRecovery();

    const parent = new FakeNode();
    const translatedWrapper = new FakeNode();
    const child = new FakeNode();
    translatedWrapper.appendChild(child);

    expect(() => parent.removeChild(child)).not.toThrow();
    expect(parent.removeChild(child)).toBe(child);
  });

  it("recovers when React inserts before a stale translated reference node", () => {
    installFakeBrowser("ar-SA");
    installExternalDomMutationRecovery();

    const parent = new FakeNode();
    const staleTranslatedParent = new FakeNode();
    const staleReference = new FakeNode();
    const newNode = new FakeNode();
    staleTranslatedParent.appendChild(staleReference);

    expect(() => parent.insertBefore(newNode, staleReference)).not.toThrow();
    expect(parent.children).toContain(newNode);
  });

  it("keeps normal DOM operations unchanged when translation is disabled", () => {
    installFakeBrowser("en-US");
    installExternalDomMutationRecovery();

    const parent = new FakeNode();
    const first = new FakeNode();
    const second = new FakeNode();
    parent.appendChild(first);

    expect(parent.insertBefore(second, first)).toBe(second);
    expect(parent.children).toEqual([second, first]);
    expect(parent.removeChild(first)).toBe(first);
    expect(parent.children).toEqual([second]);
  });

  it("detects browser-translation DOM mutation errors without hiding ordinary errors", () => {
    const mutationError = new Error("Failed to execute 'removeChild' on 'Node'");
    mutationError.name = "NotFoundError";

    expect(isExternalDomMutationError(mutationError)).toBe(true);
    expect(isExternalDomMutationError(new Error("Network request failed"))).toBe(false);
  });

  it("adds notranslate without depending on translated visible text", () => {
    expect(noTranslateClassName()).toBe("notranslate");
    expect(noTranslateClassName("rounded-md")).toBe("notranslate rounded-md");
  });
});
