import { Suspense } from "react";

export const metadata = {
  title: "mikancel.com/blog",
};

export default function BlogLayout({ children }) {
  return <Suspense>{children}</Suspense>;
}