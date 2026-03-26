import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shows",
};

export default function ShowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
