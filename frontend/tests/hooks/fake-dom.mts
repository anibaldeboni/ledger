type TestElement = any;

export function installFakeDom() {
  const windowObject: any = {
    event: undefined,
    addEventListener() {},
    Math,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback: any) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    document: null as any,
  };

  for (const name of [
    "HTMLIFrameElement",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLSelectElement",
    "HTMLDivElement",
    "HTMLSpanElement",
    "HTMLBodyElement",
    "HTMLHtmlElement",
    "HTMLDocument",
    "Element",
    "Node",
    "Text",
    "DocumentFragment",
    "EventTarget",
  ]) {
    windowObject[name] = class {};
  }

  function makeElement(tag: string, document: any): TestElement {
    const element: TestElement = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      nodeName: tag.toUpperCase(),
      ownerDocument: document,
      parentNode: null,
      firstChild: null,
      lastChild: null,
      children: [],
      attributes: {},
      style: {},
      setAttribute(name: string, value: string) {
        this.attributes[name] = String(value);
      },
      getAttribute(name: string) {
        return name in this.attributes ? this.attributes[name] : null;
      },
      removeAttribute(name: string) {
        delete this.attributes[name];
      },
      appendChild(child: TestElement) {
        if (child.parentNode) child.parentNode.removeChild(child);
        this.children.push(child);
        child.parentNode = this;
        this.firstChild = this.children[0];
        this.lastChild = this.children[this.children.length - 1];
      },
      insertBefore(child: TestElement, reference: TestElement | null) {
        if (child.parentNode) child.parentNode.removeChild(child);
        if (!reference) {
          this.appendChild(child);
          return;
        }
        const index = this.children.indexOf(reference);
        this.children.splice(index, 0, child);
        child.parentNode = this;
        this.firstChild = this.children[0];
        this.lastChild = this.children[this.children.length - 1];
      },
      removeChild(child: TestElement) {
        const index = this.children.indexOf(child);
        this.children.splice(index, 1);
        child.parentNode = null;
        this.firstChild = this.children[0] ?? null;
        this.lastChild = this.children[this.children.length - 1] ?? null;
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
      constructor: windowObject.HTMLElement,
    };
    return element;
  }

  const document: any = {
    nodeType: 9,
    nodeName: "#document",
    documentElement: null,
    createElement: (tag: string) => makeElement(tag, document),
    createTextNode: (text: string) => ({
      nodeType: 3,
      nodeName: "#text",
      nodeValue: String(text),
      parentNode: null,
      ownerDocument: document,
    }),
    createDocumentFragment: () => makeElement("#fragment", document),
    addEventListener() {},
    removeEventListener() {},
    body: null,
    activeElement: null,
  };
  document.documentElement = makeElement("html", document);
  document.body = makeElement("body", document);
  windowObject.document = document;
  (globalThis as any).document = document;
  (globalThis as any).window = windowObject;
  (globalThis as any).self = windowObject;
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "node" },
    configurable: true,
    writable: true,
  });

  return { document, window: windowObject };
}

export function flush(milliseconds = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
