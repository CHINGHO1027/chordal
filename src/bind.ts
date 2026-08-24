/**
 * The data-sound-* attribute scanner, factored out so both index.ts (the full,
 * every-family API) and lite.ts (createPlayer(), a single loaded family) can share it
 * instead of duplicating the same DOM-binding logic. Nothing here touches family data —
 * it just wires DOM events to whatever play() callback it's given.
 */

import type { SoundFamily, SoundInstance } from './types';

export interface BindPlayOptions {
  family?: SoundFamily;
  state?: 'on' | 'off';
}

interface BindingConfig {
  attr: string;
  instance: SoundInstance;
  event: string;
}

// One attribute per instance, each firing on the DOM event that instance naturally maps to.
// error binds to the native 'invalid' event — the one real DOM event that already means
// "this input is in an error state" — rather than requiring a bespoke trigger call.
//
// submit and notification both bind to 'click' as a reasonable declarative default, but
// their more typical real usage is programmatic — call play('submit', ...) at the moment
// an async submission actually starts, or play('notification', ...) when a toast/banner
// appears, since neither is a DOM event bind() can observe on its own.
const BINDINGS: BindingConfig[] = [
  { attr: 'data-sound-hover', instance: 'hover', event: 'pointerenter' },
  { attr: 'data-sound-click', instance: 'click', event: 'pointerdown' },
  { attr: 'data-sound-congrats', instance: 'congrats', event: 'click' },
  { attr: 'data-sound-error', instance: 'error', event: 'invalid' },
  { attr: 'data-sound-toggle', instance: 'toggle', event: 'click' },
  { attr: 'data-sound-submit', instance: 'submit', event: 'click' },
  { attr: 'data-sound-notification', instance: 'notification', event: 'click' },
];

const boundAttrsByElement = new WeakMap<Element, Set<string>>();

function markBound(el: Element, attr: string): boolean {
  const bound = boundAttrsByElement.get(el) ?? new Set<string>();
  if (bound.has(attr)) return false;
  bound.add(attr);
  boundAttrsByElement.set(el, bound);
  return true;
}

/**
 * Reads on/off state at click time from aria-pressed or a checkbox's checked property.
 * Call bind() after your own toggle logic is wired up so this reads the post-toggle value.
 */
function resolveToggleState(el: Element): 'on' | 'off' {
  if (el.hasAttribute('aria-pressed')) {
    return el.getAttribute('aria-pressed') === 'true' ? 'on' : 'off';
  }
  if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    return el.checked ? 'on' : 'off';
  }
  return 'on';
}

/**
 * Builds a bind(root) function around a given play() callback. `supportsFamilyOverride`
 * controls whether an attribute's own value (e.g. data-sound-click="chime") is read as a
 * per-element family override — meaningful for index.ts, where every family is loaded and
 * available to switch to, but not for a lite.ts player, which only ever has the one family
 * it was created with.
 */
export function createBinder(
  play: (instance: SoundInstance, options: BindPlayOptions) => void,
  options: { supportsFamilyOverride: boolean }
): (root?: ParentNode) => void {
  return function bind(root: ParentNode = document): void {
    for (const { attr, instance, event } of BINDINGS) {
      root.querySelectorAll(`[${attr}]`).forEach((el) => {
        if (!markBound(el, attr)) return;
        const familyOverride = options.supportsFamilyOverride ? el.getAttribute(attr) : null;
        const playOptions: BindPlayOptions = familyOverride ? { family: familyOverride as SoundFamily } : {};
        el.addEventListener(event, () => {
          if (instance === 'toggle') {
            play(instance, { ...playOptions, state: resolveToggleState(el) });
          } else {
            play(instance, playOptions);
          }
        });
      });
    }
  };
}
