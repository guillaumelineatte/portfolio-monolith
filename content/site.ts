import type { SiteConfig } from "./types";

// TODO: replace with the real name, role, email and bio.
export const site: SiteConfig = {
  name: "Guillaume",
  role: "Interactive developer",
  email: "hello@guillaume.dev",
  bio: "I'm Guillaume, an independent developer building interactive websites for studios, brands and cultural institutions. I care about what people feel before they notice it: light, rhythm, the weight of a transition. Based in France, working everywhere.",
  // TODO: replace with the real track record.
  awards: [
    { count: 15, label: "Awwwards Honorable Mention" },
    { count: 6, label: "Awwwards Site of the Day" },
    { count: 4, label: "Awwwards Developer Award" },
    { count: 3, label: "FWA of the Day" },
    { count: 2, label: "CSS Design Awards Website of the Day" },
    { count: 1, label: "Webby Awards Nominee" },
  ],
  homeColor: "#F4B27C",
  aboutColor: "#E9A3A8",
};
