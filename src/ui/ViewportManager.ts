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

export class ViewportManager {
  private forcedLandscape = false;
  private readonly listeners = new Set<() => void>();
  private readonly gameRoot: HTMLElement;

  constructor(gameRoot: HTMLElement) {
    this.gameRoot = gameRoot;

    const sync = () => this.applyLayout();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    document.addEventListener('fullscreenchange', () => {
      if (!this.isNativeFullscreen()) {
        // Keep forcedLandscape only if user explicitly toggled it while non-fullscreen,
        // otherwise sync cleanly
      }
      this.applyLayout();
    });
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  isMobileViewport(): boolean {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return touch || Math.min(window.innerWidth, window.innerHeight) <= 540;
  }

  isNativeFullscreen(): boolean {
    const doc = document as WebkitFullscreenDocument;
    return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
  }

  isLandscapeActive(): boolean {
    return this.isNativeFullscreen() || this.forcedLandscape;
  }

  isCssRotated(): boolean {
    return this.forcedLandscape && window.innerHeight > window.innerWidth;
  }

  getLogicalSize(): { width: number; height: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.isCssRotated()) {
      return { width: h, height: w };
    }
    return { width: w, height: h };
  }

  mapClientToLogical(clientX: number, clientY: number): { x: number; y: number } {
    if (this.isCssRotated()) {
      const w = window.innerWidth;
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
      this.gameRoot.classList.add('forced-landscape');
    } else {
      this.gameRoot.classList.remove('forced-landscape');
    }
    for (const fn of this.listeners) {
      fn();
    }
  }
}
