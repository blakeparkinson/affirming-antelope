import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Blake Parkinson | Affirming Antelope";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "About",
    title: "Blake Parkinson",
    subtitle: "Head of Engineering at Big Leap Health. Builds Affirming Antelope.",
  });
}
