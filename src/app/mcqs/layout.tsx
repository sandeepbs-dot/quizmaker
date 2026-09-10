import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "MCQs | Quiz Maker",
	description: "Manage multiple-choice questions in the shared test bank.",
};

export default function McqsLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return children;
}
