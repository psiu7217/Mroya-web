import type {Element, Root} from 'hast';
import {documentImageId} from './documentImage';

/** Hide redundant download links in older image replies, including reference links. */
export function removeImageDownloadLinks() {
  return (tree: Root) => {
    const imageIds = new Set<string>();
    function collect(parent: Root | Element) {
      for (const child of parent.children) {
        if (child.type !== 'element') continue;
        if (child.tagName === 'img' && typeof child.properties.src === 'string') {
          const id = documentImageId(child.properties.src);
          if (id) imageIds.add(id.toLowerCase());
        }
        collect(child);
      }
    }
    function remove(parent: Root | Element): boolean {
      let changed = false;
      for (let index = parent.children.length - 1; index >= 0; index--) {
        const child = parent.children[index];
        if (child.type !== 'element') continue;
        const href = child.properties.href;
        const id = child.tagName === 'a' && typeof href === 'string' ? documentImageId(href) : null;
        if (id && imageIds.has(id.toLowerCase())) {
          // A reply can wrap the image itself in a link to the original.
          const images = child.children.filter(node => node.type === 'element' && node.tagName === 'img');
          parent.children.splice(index, 1, ...images);
          changed = true;
        } else if (remove(child)) {
          changed = true;
          if (child.tagName === 'p' && child.children.every(node =>
            (node.type === 'text' && !node.value.trim()) || (node.type === 'element' && node.tagName === 'br'))) {
            parent.children.splice(index, 1);
          }
        }
      }
      return changed;
    }
    collect(tree);
    if (imageIds.size) remove(tree);
  };
}
