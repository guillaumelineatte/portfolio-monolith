import type { Project } from "./types";

// TODO: replace every project below with real work, drop the photos in public/work/ and set
// `image` on each one (e.g. image: "/work/ostrea.jpg"). Without it the procedural visual is used.
export const projects: Project[] = [
  {
    slug: "ostrea",
    title: "Ostrea",
    year: "2025",
    role: "Creative development, WebGL",
    client: "Maison Ostrea",
    text: "An online shop for an oyster farm on the Breton coast, built around a tide that rises and falls as you scroll. Each product sits in the light of the hour at which the page is opened.",
    color: "#F2A65A",
    visual: "waves",
  },
  {
    slug: "nocturne",
    title: "Nocturne",
    year: "2025",
    role: "Interactive direction",
    client: "Festival Nocturne",
    text: "The digital home of a light festival staged in disused industrial sites. Visitors sketch their own installation in the browser before walking into the real one.",
    color: "#E8839A",
    visual: "orb",
  },
  {
    slug: "atlas-des-vents",
    title: "Atlas des vents",
    year: "2024",
    role: "Data visualisation, WebGL",
    client: "Atelier Cartographique",
    text: "A living map of the winds over Europe, redrawn every hour from open meteorological data. Currents are rendered as long ink strokes rather than arrows, so the weather reads like a drawing.",
    color: "#9DB8E8",
    visual: "rings",
  },
  {
    slug: "maison-verlaine",
    title: "Maison Verlaine",
    year: "2024",
    role: "Front-end, motion",
    client: "Maison Verlaine, Paris",
    text: "A fragrance house that wanted its website to feel like opening a drawer. Slow transitions, paper textures and a single product at a time.",
    color: "#F0B6A0",
    visual: "arches",
  },
  {
    slug: "carriere",
    title: "Carrière",
    year: "2024",
    role: "Creative development",
    client: "Atelier Carrière Architectes",
    text: "Portfolio for an architecture practice working with raw stone. Each building is introduced by a section drawing that extrudes into volume as you read.",
    color: "#E6B36E",
    visual: "strata",
  },
  {
    slug: "sillage",
    title: "Sillage",
    year: "2023",
    role: "WebGL, configurator",
    client: "Chantier Sillage",
    text: "A configurator for a small wooden sailboat yard. The hull answers wind and swell in real time while you choose its finish.",
    color: "#7FA6D9",
    visual: "grid",
  },
  {
    slug: "ferrum",
    title: "Ferrum",
    year: "2023",
    role: "Creative development",
    client: "Fonderie Ferrum",
    text: "An archive of cast bronze from an art foundry, lit as if by the pour itself. Molten metal shaders, built to run smoothly on a phone.",
    color: "#E8764A",
    visual: "orb",
  },
  {
    slug: "opale",
    title: "Opale",
    year: "2023",
    role: "Product design, front-end",
    client: "Opale",
    text: "A breathing companion whose whole interface follows the rhythm of a single slow gradient. No streaks, no scores, no notifications.",
    color: "#B9A6E0",
    visual: "rings",
  },
  {
    slug: "cendres",
    title: "Cendres",
    year: "2022",
    role: "Development",
    client: "Galerie Cendres",
    text: "An online gallery for contemporary ceramics where every piece can be turned under a raking light. Photogrammetry compressed to load in under two seconds.",
    color: "#D9A58F",
    visual: "arches",
  },
  {
    slug: "lueur-boreale",
    title: "Lueur boréale",
    year: "2022",
    role: "WebGL, installation",
    client: "Observatoire du Nord",
    text: "An aurora shown on a planetarium dome and in the browser from the same code. The sky follows the solar wind recorded the night before.",
    color: "#8FCBD0",
    visual: "waves",
  },
  {
    slug: "tessiture",
    title: "Tessiture",
    year: "2022",
    role: "Creative development, audio",
    client: "Tessiture Records",
    text: "A record label where each release has a surface you can play with the cursor. The shaders listen to the actual stems of every track.",
    color: "#D98BB8",
    visual: "grid",
  },
  {
    slug: "albatre",
    title: "Albâtre",
    year: "2026",
    role: "Research",
    client: "Personal study",
    text: "A long-running study of translucent materials in real time: stone, wax, paper, skin. The monolith behind this page is its latest iteration.",
    color: "#F3D9B8",
    visual: "strata",
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getProjectIndex(slug: string): number {
  return projects.findIndex((p) => p.slug === slug);
}
