import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archive",
  description: "Movies and shows you've removed from your library",
};

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
