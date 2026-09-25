export interface Award {
  count: number;
  label: string;
}

export interface Project {
  slug: string;
  title: string;
  year: string;
  role: string;
  client: string;
  /** Hex color used for the light and the home/project hover accents. */
  color: string;
  /** Procedural fallback recipe (see lib/visual.ts) used until a real image is supplied. */
  visual: "waves" | "orb" | "rings" | "arches" | "strata" | "grid";
  text: string;
  /** Photo in public/work/. Optional until the real ones are in, the procedural visual is used meanwhile. */
  image?: string;
}

export interface SiteConfig {
  name: string;
  role: string;
  email: string;
  bio: string;
  awards: Award[];
  homeColor: string;
  aboutColor: string;
}
