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
  // light color + hover accent
  color: string;
  // placeholder style until there's a photo (lib/visual.ts)
  visual: "waves" | "orb" | "rings" | "arches" | "strata" | "grid";
  text: string;
  // photo in public/work/, optional for now
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
