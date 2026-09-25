import gsap from "gsap";

const EO = "expo.out";

/** Measures wrapped word spans into line groups and wraps each in an overflow-hidden mask. */
export function splitLines(el: HTMLElement): void {
  const text = el.dataset.text || el.textContent?.trim().replace(/\s+/g, " ") || "";
  el.dataset.text = text;
  el.textContent = "";
  const words = text.split(" ");
  const spans = words.map((w, i) => {
    const s = document.createElement("span");
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    return s;
  });
  const lines: string[][] = [];
  let top: number | null = null;
  spans.forEach((s) => {
    const t = s.offsetTop;
    if (top === null || Math.abs(t - top) > 2) {
      lines.push([]);
      top = t;
    }
    lines[lines.length - 1].push(s.textContent || "");
  });
  el.textContent = "";
  lines.forEach((l) => {
    const o = document.createElement("span");
    o.className = "line";
    const i = document.createElement("span");
    i.className = "line-i";
    i.textContent = l.join(" ");
    o.appendChild(i);
    el.appendChild(o);
  });
}

export function prepareView(view: HTMLElement, reducedMotion: boolean, hasWebGL: boolean): void {
  view.style.visibility = "hidden";
  // HomeView and ProjectView both render a top-level <section>, so React reuses the same node
  // and the inline opacity 0 from animateOut's fallback fade would stick. Reset it every time.
  view.style.opacity = "";
  view.querySelectorAll<HTMLElement>("[data-split]").forEach(splitLines);
  if (reducedMotion) {
    view.querySelectorAll<HTMLElement>("[data-group]").forEach((g) => {
      g.style.opacity = "0";
    });
  } else {
    const lines = view.querySelectorAll(".line-i");
    if (lines.length) gsap.set(lines, { yPercent: 110 });
    if (!hasWebGL) {
      view.querySelectorAll<HTMLElement>("[data-visual]").forEach((v) => {
        v.style.opacity = "0";
      });
    }
  }
  view.style.visibility = "";
}

export function revealGroup(
  g: HTMLElement,
  delay: number,
  reducedMotion: boolean,
  hasWebGL: boolean,
  onVisual?: (el: HTMLElement, delay: number) => void
): void {
  if (g.dataset.revealed) return;
  g.dataset.revealed = "1";
  if (reducedMotion) {
    gsap.to(g, { opacity: 1, duration: 0.9, ease: "power1.out", delay });
  } else {
    const lines = Array.from(g.querySelectorAll(".line-i"));
    if (lines.length) gsap.to(lines, { yPercent: 0, duration: 1.6, ease: EO, stagger: 0.075, delay });
  }
  if (g.hasAttribute("data-visual")) {
    if (hasWebGL && onVisual) {
      setTimeout(() => onVisual(g, delay), delay * 1000);
    } else if (!hasWebGL && !reducedMotion) {
      gsap.to(g, { opacity: 1, duration: 1.4, ease: EO, delay });
    }
  }
}

export function enterView(
  view: HTMLElement,
  reducedMotion: boolean,
  hasWebGL: boolean,
  onVisual?: (el: HTMLElement, delay: number) => void
): IntersectionObserver {
  const observer = new IntersectionObserver(
    (entries) => {
      let k = 0;
      entries.forEach((en) => {
        if (en.isIntersecting) {
          revealGroup(en.target as HTMLElement, k * 0.07, reducedMotion, hasWebGL, onVisual);
          k++;
          observer.unobserve(en.target);
        }
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.01 }
  );
  view.querySelectorAll<HTMLElement>("[data-group]").forEach((g) => observer.observe(g));
  return observer;
}

export function animateOut(view: HTMLElement, reducedMotion: boolean, hasWebGL: boolean): Promise<void> {
  return new Promise((res) => {
    if (reducedMotion) {
      gsap.to(view, { opacity: 0, duration: 0.45, ease: "power1.out", onComplete: () => res() });
      return;
    }
    const lines = Array.from(view.querySelectorAll<HTMLElement>(".line-i")).filter((l) => {
      const r = l.getBoundingClientRect();
      return r.bottom > -40 && r.top < window.innerHeight + 40;
    });
    if (!hasWebGL) {
      view.querySelectorAll<HTMLElement>("[data-visual]").forEach((v) => gsap.to(v, { opacity: 0, duration: 0.5 }));
    }
    if (!lines.length) {
      // Nothing to animate (home list and project title/meta are static). Resolving right away
      // gave a hard cut on click, so fade instead.
      gsap.to(view, { opacity: 0, duration: 0.4, ease: "power1.in", onComplete: () => res() });
      return;
    }
    gsap.to(lines, {
      yPercent: -110,
      duration: 0.75,
      ease: "power3.in",
      stagger: { amount: 0.18 },
      overwrite: true,
      onComplete: () => res(),
    });
  });
}

export function resplit(view: HTMLElement | null, reducedMotion: boolean): void {
  if (!view) return;
  view.querySelectorAll<HTMLElement>("[data-split]").forEach(splitLines);
  if (reducedMotion) return;
  view.querySelectorAll<HTMLElement>("[data-group]").forEach((g) => {
    const lines = g.querySelectorAll(".line-i");
    if (lines.length) gsap.set(lines, { yPercent: g.dataset.revealed ? 0 : 110 });
  });
}
