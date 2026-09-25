"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useSceneStore } from "@/lib/store";
import { site } from "@/content/site";

const EO = "expo.out";

export function Header() {
  const headerLabel = useSceneStore((s) => s.headerLabel);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const booted = useSceneStore((s) => s.booted);
  const labelRef = useRef<HTMLSpanElement>(null);
  const nameLineRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const isFirstLabel = useRef(true);
  const introFired = useRef(false);
  const isAbout = headerLabel === "Index";

  // Text set imperatively + GSAP mask, React never re-renders the label.
  useEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    if (isFirstLabel.current) {
      isFirstLabel.current = false;
      el.textContent = headerLabel;
      return;
    }
    if (el.textContent === headerLabel) return;
    if (reducedMotion) {
      el.textContent = headerLabel;
      return;
    }
    gsap.to(el, {
      yPercent: -110,
      duration: 0.45,
      ease: "power3.in",
      onComplete() {
        el.textContent = headerLabel;
        gsap.fromTo(el, { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: EO });
      },
    });
  }, [headerLabel, reducedMotion]);

  // Keep the header lines hidden under the loader until boot is done, then reveal.
  useEffect(() => {
    if (reducedMotion) return;
    const lines = [nameLineRef.current, labelRef.current].filter((el): el is HTMLSpanElement => !!el);
    gsap.set(lines, { yPercent: 110 });
  }, [reducedMotion]);

  useEffect(() => {
    if (!booted || introFired.current) return;
    introFired.current = true;
    const lines = [nameLineRef.current, labelRef.current].filter((el): el is HTMLSpanElement => !!el);
    if (reducedMotion) {
      gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power1.out" });
    } else {
      gsap.to(lines, { yPercent: 0, duration: 1.6, ease: EO, stagger: 0.1, delay: 1.2 });
    }
  }, [booted, reducedMotion]);

  return (
    <header className="hd" ref={rootRef}>
      <Link className="hd-name" href="/">
        <span className="line">
          <span className="line-i" ref={nameLineRef}>
            {site.name}
          </span>
        </span>
      </Link>
      <Link className="hd-about" href={isAbout ? "/" : "/about"}>
        <span className="line">
          <span className="line-i" ref={labelRef}>
            About
          </span>
        </span>
      </Link>
    </header>
  );
}
