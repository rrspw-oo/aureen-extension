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

/**
 * Create highlight position from selection
 */
export function createHighlightPosition(selection: Selection): HighlightPosition | null {
  const range = selection.getRangeAt(0);
  if (!range) {
    return null;
  }

  const startContainer = range.startContainer;

  // Get XPath for start container
  const xpath = getXPath(startContainer);

  return {
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    xpath,
    textContent: range.toString()
  };
}

/**
 * Restore range from highlight position
 */
export function restoreRangeFromPosition(
  position: HighlightPosition
): Range | null {
  try {
    const node = getNodeByXPath(position.xpath);
    if (!node) {
      return null;
    }

    const range = document.createRange();
    const startNode = getTextNodeAndOffset(node, position.startOffset);
    const endNode = getTextNodeAndOffset(node, position.endOffset);

    if (!startNode || !endNode) {
      return null;
    }

    range.setStart(startNode.node, startNode.offset);
    range.setEnd(endNode.node, endNode.offset);

    return range;
  } catch (error) {
    console.error('Error restoring range:', error);
    return null;
  }
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

/**
 * Wrap text node with highlight element
 */
export function wrapTextWithHighlight(
  textNode: Text,
  startOffset: number,
  endOffset: number,
  highlightId: string,
  color: string
): HTMLElement {
  const range = document.createRange();
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);

  const mark = document.createElement('mark');
  mark.className = `highlight-mark ${color}`;
  mark.dataset.highlightId = highlightId;

  range.surroundContents(mark);

  return mark;
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
      border-color: #DDDDEF;
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
