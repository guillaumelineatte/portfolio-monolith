import { site } from "@/content/site";
import { projects, getProjectIndex } from "@/content/projects";
import type { RouteName } from "./store";

export interface RouteDescriptor {
  name: RouteName;
  index: number;
}

export function routeFromPathname(pathname: string): RouteDescriptor {
  if (pathname === "/about") return { name: "about", index: -1 };
  const m = pathname.match(/^\/work\/([\w-]+)/);
  if (m) {
    const i = getProjectIndex(m[1]);
    if (i >= 0) return { name: "project", index: i };
  }
  return { name: "home", index: -1 };
}

export function pathnameFromRoute(route: RouteDescriptor): string {
  if (route.name === "about") return "/about";
  if (route.name === "project") return `/work/${projects[route.index].slug}`;
  return "/";
}

export function sameRoute(a: RouteDescriptor | null, b: RouteDescriptor | null): boolean {
  return !!a && !!b && a.name === b.name && a.index === b.index;
}

export function routeColor(r: RouteDescriptor): string {
  if (r.name === "home") return site.homeColor;
  if (r.name === "about") return site.aboutColor;
  return projects[r.index].color;
}

export function titleFor(r: RouteDescriptor): string {
  if (r.name === "home") return `${site.name} — ${site.role}`;
  if (r.name === "about") return `About — ${site.name}`;
  return `${projects[r.index].title} — ${site.name}`;
}
