/**
 * Client-only playback tracking for the three supported providers (AGENTS.md §9).
 *
 * `attachVideoTracker` wires one provider embed and calls back on first play and
 * on periodic progress. It owns nothing analytics-specific — `LessonVideo`
 * decides which PostHog events to fire and de-duplicates milestones.
 *
 * No dependencies: YouTube uses its IFrame Player API (script injected here),
 * Vimeo uses the `player.vimeo.com` postMessage protocol, Bunny uses the
 * Player.js protocol its `iframe.mediadelivery.net` embed implements. Every
 * inbound `postMessage` is origin-checked before it is trusted.
 */

import type { VideoProvider } from "@/lib/video";

export type VideoProgress = {
  /** 0–100, floored. */
  percent: number;
  currentSeconds: number;
  durationSeconds: number;
};

export type VideoTrackerHandlers = {
  onPlay: () => void;
  onProgress: (progress: VideoProgress) => void;
};

/** Attach tracking to a mounted iframe. Returns a cleanup function. */
export function attachVideoTracker(
  iframe: HTMLIFrameElement,
  provider: VideoProvider,
  handlers: VideoTrackerHandlers,
): () => void {
  switch (provider) {
    case "youtube":
      return attachYouTube(iframe, handlers);
    case "vimeo":
      return attachPostMessage(iframe, "https://player.vimeo.com", handlers, vimeoAdapter);
    case "bunny":
      return attachPostMessage(
        iframe,
        "https://iframe.mediadelivery.net",
        handlers,
        bunnyAdapter,
      );
  }
}

/* ------------------------------ YouTube --------------------------------- */

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement | string,
    opts: { events?: { onStateChange?: (e: { data: number }) => void } },
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTNamespace>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
  return ytApiPromise;
}

function attachYouTube(
  iframe: HTMLIFrameElement,
  handlers: VideoTrackerHandlers,
): () => void {
  let player: YTPlayer | null = null;
  let interval: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;

  const poll = () => {
    if (!player) return;
    const durationSeconds = player.getDuration();
    const currentSeconds = player.getCurrentTime();
    if (!durationSeconds || !Number.isFinite(durationSeconds)) return;
    handlers.onProgress({
      percent: Math.floor((currentSeconds / durationSeconds) * 100),
      currentSeconds,
      durationSeconds,
    });
  };

  loadYouTubeApi()
    .then((YT) => {
      if (cancelled) return;
      player = new YT.Player(iframe, {
        events: {
          onStateChange: (e) => {
            if (e.data !== YT.PlayerState.PLAYING) return;
            handlers.onPlay();
            if (!interval) interval = setInterval(poll, 5000);
          },
        },
      });
    })
    .catch(() => {
      /* API blocked — embed still plays, just no analytics. */
    });

  return () => {
    cancelled = true;
    if (interval) clearInterval(interval);
    try {
      player?.destroy();
    } catch {
      /* noop */
    }
    player = null;
  };
}

/* --------------------- Vimeo / Bunny (postMessage) --------------------- */

type ProviderAdapter = {
  /** Messages to post once the iframe has loaded, to subscribe to events. */
  subscribe: (post: (msg: unknown) => void) => void;
  /** Translate one inbound message into a play / progress signal, or null. */
  parse: (data: unknown) => { type: "play" } | ({ type: "progress" } & VideoProgress) | null;
};

function attachPostMessage(
  iframe: HTMLIFrameElement,
  origin: string,
  handlers: VideoTrackerHandlers,
  adapter: ProviderAdapter,
): () => void {
  const post = (msg: unknown) => iframe.contentWindow?.postMessage(msg, origin);

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== iframe.contentWindow) return;
    let data: unknown = event.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    const signal = adapter.parse(data);
    if (!signal) return;
    if (signal.type === "play") {
      handlers.onPlay();
    } else {
      handlers.onProgress(signal);
    }
  };

  window.addEventListener("message", onMessage);
  // Subscribe now and again on load — providers accept either ordering.
  adapter.subscribe(post);
  const onLoad = () => adapter.subscribe(post);
  iframe.addEventListener("load", onLoad);

  return () => {
    window.removeEventListener("message", onMessage);
    iframe.removeEventListener("load", onLoad);
  };
}

const vimeoAdapter: ProviderAdapter = {
  subscribe: (post) => {
    post({ method: "addEventListener", value: "play" });
    post({ method: "addEventListener", value: "timeupdate" });
  },
  parse: (data) => {
    if (typeof data !== "object" || data === null) return null;
    const msg = data as { event?: string; data?: { seconds?: number; duration?: number; percent?: number } };
    if (msg.event === "play") return { type: "play" };
    if (msg.event === "timeupdate" && msg.data) {
      const currentSeconds = msg.data.seconds ?? 0;
      const durationSeconds = msg.data.duration ?? 0;
      if (!durationSeconds) return null;
      const percent =
        typeof msg.data.percent === "number"
          ? Math.floor(msg.data.percent * 100)
          : Math.floor((currentSeconds / durationSeconds) * 100);
      return { type: "progress", percent, currentSeconds, durationSeconds };
    }
    return null;
  },
};

const bunnyAdapter: ProviderAdapter = {
  subscribe: (post) => {
    const base = { context: "player.js", version: "0.0.11" };
    post({ ...base, method: "addEventListener", value: "play", listener: "play" });
    post({ ...base, method: "addEventListener", value: "timeupdate", listener: "timeupdate" });
  },
  parse: (data) => {
    if (typeof data !== "object" || data === null) return null;
    const msg = data as {
      context?: string;
      event?: string;
      value?: { seconds?: number; duration?: number };
    };
    if (msg.context !== "player.js") return null;
    if (msg.event === "play") return { type: "play" };
    if (msg.event === "timeupdate" && msg.value) {
      const currentSeconds = msg.value.seconds ?? 0;
      const durationSeconds = msg.value.duration ?? 0;
      if (!durationSeconds) return null;
      return {
        type: "progress",
        percent: Math.floor((currentSeconds / durationSeconds) * 100),
        currentSeconds,
        durationSeconds,
      };
    }
    return null;
  },
};
