import { Inter, Newsreader } from "next/font/google";
// import localFont from "next/font/local";

// Variable axis, same as the prototype's Google Fonts link.
// (An array of static weights breaks under Turbopack anyway.)
export const inter = Inter({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-inter",
  display: "swap",
});

// Serif for the project titles, opsz follows the font size.
export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

// TODO: uncomment once the Neue Montreal files are in public/fonts/ and put
// var(--font-neue-montreal) first in the body font stack. next/font/local fails the build
// when the files are missing, so it stays commented for now.
// export const neueMontreal = localFont({
//   src: [
//     { path: "../public/fonts/NeueMontreal-Light.woff2", weight: "300", style: "normal" },
//     { path: "../public/fonts/NeueMontreal-Regular.woff2", weight: "400", style: "normal" },
//     { path: "../public/fonts/NeueMontreal-Medium.woff2", weight: "500", style: "normal" },
//   ],
//   variable: "--font-neue-montreal",
//   display: "swap",
// });
