interface ScreenOrientationWithLock extends ScreenOrientation {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'any') => Promise<void>;
}

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface WebkitFullscreenDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

const MIN_WORLD_SHORT_SIDE = 860;
const MAX_WORLD_LONG_SIDE = 2240;

export class ViewportManager {
  private forcedLandscape = false;
  private readonly listeners = new Set<() => void>();
  private readonly gameRoot: HTMLElement;

  constructor(gameRoot: HTMLElement) {
    this.gameRoot = gameRoot;

    const sync = () => {
      this.applyLayout();
    };
    const delayedSync = () => {
      this.applyLayout();
      window.setTimeout(() => this.applyLayout(), 120);
      window.setTimeout(() => this.applyLayout(), 320);
    };

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', delayedSync);
    window.visualViewport?.addEventListener('resize', sync);
    document.addEventListener('fullscreenchange', delayedSync);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private getRawViewport(): { width: number; height: number } {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width || window.innerWidth || 800);
    const h = Math.round(vv?.height || window.innerHeight || 600);
    return { width: Math.max(240, w), height: Math.max(240, h) };
  }

  isMobileViewport(): boolean {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const { width, height } = this.getRawViewport();
    return touch || Math.min(width, height) <= 540;
  }

  isNativeFullscreen(): boolean {
    const doc = document as WebkitFullscreenDocument;
    return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
  }

  isLandscapeActive(): boolean {
    return this.isNativeFullscreen() || this.forcedLandscape;
  }

  isCssRotated(): boolean {
    const { width, height } = this.getRawViewport();
    return this.forcedLandscape && height > width;
  }

  getLogicalSize(): { width: number; height: number } {
    const { width: w, height: h } = this.getRawViewport();
    if (this.forcedLandscape && h > w) {
      return { width: h, height: w };
    }
    return { width: w, height: h };
  }

  /**
   * Computes a tactical world resolution that preserves the exact screen aspect ratio
   * while guaranteeing a wide Vampire-Survivors field of view on compact mobile screens
   * (so heroes/enemies never look zoomed-in or oversized on 844x390 phones).
   */
  getWorldSize(): { width: number; height: number } {
    const { width: cssW, height: cssH } = this.getLogicalSize();
    const shortSide = Math.min(cssW, cssH);
    let scale = shortSide < MIN_WORLD_SHORT_SIDE ? MIN_WORLD_SHORT_SIDE / shortSide : 1;

    const longSide = Math.max(cssW, cssH);
    if (longSide * scale > MAX_WORLD_LONG_SIDE) {
      scale = MAX_WORLD_LONG_SIDE / longSide;
    }

    return {
      width: Math.round(cssW * scale),
      height: Math.round(cssH * scale),
    };
  }

  mapClientToLogical(clientX: number, clientY: number): { x: number; y: number } {
    if (this.isCssRotated()) {
      const { width: w } = this.getRawViewport();
      return {
        x: clientY,
        y: w - clientX,
      };
    }
    return { x: clientX, y: clientY };
  }

  async enterFullscreenLandscape(): Promise<void> {
    this.forcedLandscape = true;
    const docEl = document.documentElement as WebkitFullscreenElement;
    try {
      if (!this.isNativeFullscreen()) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen({ navigationUI: 'hide' });
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignore if browser blocks fullscreen; CSS forced-landscape still activates!
    }

    try {
      const orient = screen.orientation as ScreenOrientationWithLock | undefined;
      if (orient?.lock) {
        await orient.lock('landscape');
      }
    } catch {
      // iOS Safari / desktop emulators don't support orientation.lock — CSS rotation handles it seamlessly!
    }

    this.applyLayout();
  }

  async exitFullscreenLandscape(): Promise<void> {
    this.forcedLandscape = false;
    const doc = document as WebkitFullscreenDocument;
    try {
      const orient = screen.orientation as ScreenOrientationWithLock | undefined;
      orient?.unlock?.();
    } catch {
      // ignore
    }
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // ignore
    }
    this.applyLayout();
  }

  async toggleFullscreenLandscape(): Promise<boolean> {
    if (this.isLandscapeActive()) {
      await this.exitFullscreenLandscape();
      return false;
    } else {
      await this.enterFullscreenLandscape();
      return true;
    }
  }

  applyLayout(): void {
    if (this.isCssRotated()) {
      const { width: w, height: h } = this.getRawViewport();
      this.gameRoot.classList.add('forced-landscape');
      this.gameRoot.style.width = `${h}px`;
      this.gameRoot.style.height = `${w}px`;
      this.gameRoot.style.transform = `translateX(${w}px) rotate(90deg)`;
    } else {
      this.gameRoot.classList.remove('forced-landscape');
      this.gameRoot.style.width = '';
      this.gameRoot.style.height = '';
      this.gameRoot.style.transform = '';
    }
    for (const fn of this.listeners) {
      fn();
    }
  }
}
