import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function McqNotFound() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-md">
				<Card>
					<CardHeader>
						<CardTitle>MCQ not found</CardTitle>
						<CardDescription>
							This question may have been deleted or the link is invalid.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button variant="outline" render={<Link href="/mcqs" />}>
							Back to MCQ list
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
