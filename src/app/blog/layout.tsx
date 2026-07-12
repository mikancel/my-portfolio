import { Suspense } from "react";

export const metadata = {
  title: "mikancel.com/blog",
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}