"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { site } from "@/content/site";
import { useSceneStore } from "@/lib/store";

const EO = "expo.out";

function charSpans(el: HTMLElement, text: string): HTMLElement[] {
  el.textContent = "";
  Array.from(text).forEach((ch) => {
    const s = document.createElement("span");
    s.className = "ch";
    s.textContent = ch;
    el.appendChild(s);
  });
  return Array.from(el.querySelectorAll<HTMLElement>(".ch"));
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function AboutView() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const aRef = useRef<HTMLSpanElement>(null);
  const bRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const aChRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const btn = btnRef.current;
    const a = aRef.current;
    const b = bRef.current;
    if (!btn || !a || !b) return;

    aChRef.current = charSpans(a, "Copy email");
    gsap.set(b, { yPercent: 110 });

    const onClick = async () => {
      const reduced = useSceneStore.getState().reducedMotion;
      let ok = false;
      try {
        await navigator.clipboard.writeText(site.email);
        ok = true;
      } catch {
        ok = legacyCopy(site.email);
      }
      const bCh = charSpans(b, ok ? "Copied" : site.email);
      b.removeAttribute("aria-hidden");
      const live = document.getElementById("live");
      if (live) live.textContent = ok ? "Email copied" : site.email;

      clearTimeout(timerRef.current);
      gsap.killTweensOf([a, b, ...aChRef.current, ...bCh]);

      if (reduced) {
        gsap.set(b, { yPercent: 0, opacity: 0 });
        gsap.to(a, { opacity: 0, duration: 0.3 });
        gsap.to(b, { opacity: 1, duration: 0.4 });
      } else {
        gsap.set(b, { yPercent: 0 });
        gsap.set(a, { yPercent: 0 });
        gsap.to(aChRef.current, { yPercent: -110, duration: 0.6, ease: EO, stagger: 0.018 });
        gsap.fromTo(bCh, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: EO, stagger: 0.028, delay: 0.05 });
      }

      timerRef.current = setTimeout(
        () => {
          b.setAttribute("aria-hidden", "true");
          if (reduced) {
            gsap.to(b, { opacity: 0, duration: 0.3 });
            gsap.to(a, { opacity: 1, duration: 0.4 });
            return;
          }
          gsap.to(Array.from(b.querySelectorAll(".ch")), { yPercent: -110, duration: 0.6, ease: EO, stagger: 0.015 });
          aChRef.current = Array.from(a.querySelectorAll<HTMLElement>(".ch"));
          gsap.fromTo(aChRef.current, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: EO, stagger: 0.02, delay: 0.08 });
        },
        ok ? 2200 : 6000
      );
    };

    btn.addEventListener("click", onClick);
    return () => {
      btn.removeEventListener("click", onClick);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <section className="view about" tabIndex={-1}>
      <h1 className="sr">About</h1>
      <p className="bio" data-group data-split>
        {site.bio}
      </p>
      <ul className="awards">
        {site.awards.map((a) => (
          <li data-group key={a.label}>
            <span className="aw-q">
              <span className="line">
                <span className="line-i">{a.count}x</span>
              </span>
            </span>
            <span className="aw-l" data-split>
              {a.label}
            </span>
          </li>
        ))}
      </ul>
      <div data-group>
        <button className="copy" type="button" ref={btnRef}>
          <span className="line">
            <span className="line-i">
              <span className="copy-mask">
                <span className="copy-a" ref={aRef}>
                  Copy email
                </span>
                <span className="copy-b" aria-hidden="true" ref={bRef}>
                  Copied
                </span>
              </span>
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
