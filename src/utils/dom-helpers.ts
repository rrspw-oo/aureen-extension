/**
 * DOM Helper Utilities
 * Functions for DOM manipulation, XPath generation, and element positioning
 */

import type { HighlightPosition } from '@/types';

/**
 * Generate XPath for a given DOM node
 */
export function getXPath(node: Node): string {
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return '/';
  }

  const parent = node.parentNode;
  if (!parent) {
    return '';
  }

  const parentPath = getXPath(parent);

  // Handle text nodes specially - use text() in XPath
  let nodeName: string;
  if (node.nodeType === Node.TEXT_NODE) {
    nodeName = 'text()';
  } else {
    nodeName = node.nodeName.toLowerCase();
  }

  // Get position among siblings with same type
  let position = 1;
  for (const sibling of Array.from(parent.childNodes)) {
    if (sibling === node) {
      break;
    }
    // For text nodes, compare node types; for elements, compare node names
    if (node.nodeType === Node.TEXT_NODE) {
      if (sibling.nodeType === Node.TEXT_NODE) {
        position++;
      }
    } else {
      if (sibling.nodeName === node.nodeName) {
        position++;
      }
    }
  }

  return `${parentPath}/${nodeName}[${position}]`;
}

/**
 * Find DOM node by XPath
 */
export function getNodeByXPath(xpath: string, contextNode?: Document): Node | null {
  const doc = contextNode || document;
  const result = doc.evaluate(
    xpath,
    doc,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue;
}

/**
 * Get text node and offset from selection
 */
export function getTextNodeAndOffset(
  node: Node,
  offset: number
): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { node: node as Text, offset };
  }

  // Navigate to text node within element
  let currentNode: Node | null = node;
  let currentOffset = offset;

  while (currentNode && currentNode.nodeType !== Node.TEXT_NODE) {
    const children: Node[] = Array.from(currentNode.childNodes);
    let found = false;

    for (const child of children) {
      const childLength = child.textContent?.length || 0;

      if (currentOffset <= childLength) {
        currentNode = child;
        found = true;
        break;
      }

      currentOffset -= childLength;
    }

    if (!found) {
      return null;
    }
  }

  if (currentNode && currentNode.nodeType === Node.TEXT_NODE) {
    return { node: currentNode as Text, offset: currentOffset };
  }

  return null;
}

function isHighlightMark(node: Node): boolean {
  return node instanceof HTMLElement && node.tagName === 'MARK' && node.classList.contains('highlight-mark');
}

function anchorElement(node: Node): Element {
  let element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement!;
  while (isHighlightMark(element) && element.parentElement) {
    element = element.parentElement;
  }
  return element;
}

function boundaryToAnchor(container: Node, offset: number): { xpath: string; offset: number } {
  const anchor = anchorElement(container);
  const range = document.createRange();
  range.setStart(anchor, 0);
  range.setEnd(container, offset);
  return { xpath: getXPath(anchor), offset: range.toString().length };
}

function locateInElement(element: Node, offset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (remaining <= node.length) {
      return { node, offset: remaining };
    }
    remaining -= node.length;
  }
  return null;
}

function compactText(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * Create highlight position from selection
 */
export function createHighlightPosition(selection: Selection): HighlightPosition | null {
  if (selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const start = boundaryToAnchor(range.startContainer, range.startOffset);
  const end = boundaryToAnchor(range.endContainer, range.endOffset);

  return {
    xpath: start.xpath,
    startOffset: start.offset,
    endXpath: end.xpath,
    endOffset: end.offset,
    textContent: range.toString()
  };
}

function rangeFromAnchors(position: HighlightPosition): Range | null {
  const startElement = getNodeByXPath(position.xpath);
  const endElement = getNodeByXPath(position.endXpath!);
  if (!startElement || !endElement) {
    return null;
  }

  const start = locateInElement(startElement, position.startOffset);
  const end = locateInElement(endElement, position.endOffset);
  if (!start || !end) {
    return null;
  }

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

function legacyRange(position: HighlightPosition): Range | null {
  const node = getNodeByXPath(position.xpath);
  if (!node) {
    return null;
  }

  const startNode = getTextNodeAndOffset(node, position.startOffset);
  const endNode = getTextNodeAndOffset(node, position.endOffset);
  if (!startNode || !endNode) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startNode.node, startNode.offset);
  range.setEnd(endNode.node, endNode.offset);
  return range;
}

function findRangeByText(text: string): Range | null {
  const needle = compactText(text);
  if (!needle) {
    return null;
  }

  const chars: string[] = [];
  const nodes: Text[] = [];
  const offsets: number[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      return parent && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const data = node.data;
    for (let i = 0; i < data.length; i++) {
      if (!/\s/.test(data[i])) {
        chars.push(data[i]);
        nodes.push(node);
        offsets.push(i);
      }
    }
  }

  const index = chars.join('').indexOf(needle);
  if (index < 0) {
    return null;
  }

  const last = index + needle.length - 1;
  const range = document.createRange();
  range.setStart(nodes[index], offsets[index]);
  range.setEnd(nodes[last], offsets[last] + 1);
  return range;
}

/**
 * Restore range from highlight position
 */
export function restoreRangeFromPosition(
  position: HighlightPosition,
  text: string
): Range | null {
  let range: Range | null = null;
  try {
    range = position.endXpath ? rangeFromAnchors(position) : legacyRange(position);
  } catch {
    range = null;
  }

  if (range && compactText(range.toString()) === compactText(text)) {
    return range;
  }

  return findRangeByText(text);
}

/**
 * Check if element is editable (input, textarea, contenteditable)
 */
export function isEditableElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'input' || tagName === 'textarea') {
    return true;
  }

  if (element.getAttribute('contenteditable') === 'true') {
    return true;
  }

  return false;
}

/**
 * Get position for floating toolbar relative to selection
 */
export function getToolbarPosition(selection: Selection): {
  top: number;
  left: number;
} | null {
  const range = selection.getRangeAt(0);
  if (!range) {
    return null;
  }

  const rect = range.getBoundingClientRect();

  // Position toolbar above selection with some margin
  return {
    top: rect.top + window.scrollY - 50,
    left: rect.left + window.scrollX + rect.width / 2
  };
}

/**
 * Check if selection is valid for highlighting
 */
export function isValidSelection(selection: Selection): boolean {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  const text = selection.toString().trim();
  if (text.length === 0) {
    return false;
  }

  // Check if selection is in editable element
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element =
    container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement;

  if (element && isEditableElement(element)) {
    return false;
  }

  return true;
}

export function wrapRangeWithHighlight(range: Range, highlightId: string, color: string): void {
  const root = range.commonAncestorContainer;
  const segments: { node: Text; start: number; end: number }[] = [];

  if (root.nodeType === Node.TEXT_NODE) {
    segments.push({ node: root as Text, start: range.startOffset, end: range.endOffset });
  } else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!range.intersectsNode(node)) continue;
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      segments.push({ node, start, end });
    }
  }

  for (const { node, start, end } of segments) {
    if (end <= start || !node.data.slice(start, end).trim()) continue;
    const target = start > 0 ? node.splitText(start) : node;
    if (end - start < target.length) {
      target.splitText(end - start);
    }
    const mark = document.createElement('mark');
    mark.className = `highlight-mark ${color}`;
    mark.dataset.highlightId = highlightId;
    target.parentNode!.insertBefore(mark, target);
    mark.appendChild(target);
  }
}

/**
 * Remove highlight element by ID
 */
export function removeHighlightById(highlightId: string): void {
  const marks = document.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`);

  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) {
      return;
    }

    // Replace mark with its text content
    const textNode = document.createTextNode(mark.textContent || '');
    parent.replaceChild(textNode, mark);

    // Normalize parent to merge adjacent text nodes
    parent.normalize();
  });
}

/**
 * Get all highlight marks on page
 */
export function getAllHighlightMarks(): HTMLElement[] {
  const marks = document.querySelectorAll('mark.highlight-mark');
  return Array.from(marks) as HTMLElement[];
}

/**
 * Scroll element into view smoothly
 */
export function scrollToHighlight(highlightId: string): void {
  const mark = document.querySelector(`mark[data-highlight-id="${highlightId}"]`);

  if (mark) {
    mark.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Add temporary highlight effect
    mark.classList.add('animate-pulse');
    setTimeout(() => {
      mark.classList.remove('animate-pulse');
    }, 2000);
  }
}

/**
 * Inject CSS for highlights into page
 */
export function injectHighlightStyles(): void {
  if (document.getElementById('highlighter-extension-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'highlighter-extension-styles';
  style.textContent = `
    mark.highlight-mark {
      cursor: pointer;
      transition: opacity 0.2s, border 0.2s;
      border: 2px solid transparent;
    }

    mark.highlight-mark:hover {
      opacity: 0.8;
      border-color: #C9A86C;
    }

    mark.highlight-mark.animate-pulse {
      animation: highlight-pulse 0.5s ease-in-out 3;
    }

    @keyframes highlight-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;

  document.head.appendChild(style);
}
