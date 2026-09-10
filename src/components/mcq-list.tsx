"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVertical } from "lucide-react";
import type { AuthApiResponse, PublicUser } from "@/lib/auth-utils";
import type { Mcq } from "@/lib/mcq-service";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface McqListProps {
	user: PublicUser;
	mcqs: Mcq[];
}

export function McqList({ user, mcqs }: McqListProps) {
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Mcq | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [openActionsId, setOpenActionsId] = useState<string | null>(null);

	async function handleLogout() {
		setIsLoggingOut(true);

		try {
			const response = await fetch("/api/auth/logout", { method: "POST" });
			const body = (await response.json()) as AuthApiResponse;

			if (response.ok) {
				router.push(body.redirectTo ?? "/login");
			}
		} finally {
			setIsLoggingOut(false);
		}
	}

	async function handleDeleteConfirm() {
		if (!deleteTarget) {
			return;
		}

		setIsDeleting(true);
		setDeleteError(null);

		try {
			const response = await fetch(`/api/mcqs/${deleteTarget.id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const body = (await response.json()) as { error?: string };
				setDeleteError(body.error ?? "Unable to delete this question.");
				return;
			}

			setDeleteTarget(null);
			router.refresh();
		} catch {
			setDeleteError("Unable to delete this question.");
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Multiple Choice Questions</h1>
					<p className="text-sm text-muted-foreground">
						Welcome, {user.firstName} {user.lastName}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{mcqs.length > 0 ? (
						<Button type="button" onClick={() => router.push("/mcqs/new")}>
							Create MCQ
						</Button>
					) : null}
					<Button
						type="button"
						variant="outline"
						onClick={handleLogout}
						disabled={isLoggingOut}
					>
						{isLoggingOut ? "Logging out..." : "Log out"}
					</Button>
				</div>
			</div>

			{mcqs.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>No multiple-choice questions yet</CardTitle>
						<CardDescription>
							Create your first question to start building the shared test bank.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button type="button" onClick={() => router.push("/mcqs/new")}>
							Create MCQ
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className="pt-6">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Question</TableHead>
									<TableHead className="w-[72px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{mcqs.map((mcq) => (
									<TableRow key={mcq.id}>
										<TableCell className="max-w-[200px] truncate font-medium">
											{mcq.name}
										</TableCell>
										<TableCell className="max-w-[360px] truncate">
											{mcq.question}
										</TableCell>
										<TableCell className="text-right">
											<DropdownMenu
												open={openActionsId === mcq.id}
												onOpenChange={(open) =>
													setOpenActionsId(open ? mcq.id : null)
												}
											>
												<DropdownMenuTrigger
													className={cn(
														buttonVariants({
															variant: "ghost",
															size: "icon",
														}),
													)}
													aria-label={`Actions for ${mcq.name}`}
												>
													<MoreVertical />
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => {
															setOpenActionsId(null);
															router.push(`/mcqs/${mcq.id}/edit`);
														}}
													>
														Edit
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => {
															setOpenActionsId(null);
															router.push(`/mcqs/${mcq.id}/preview`);
														}}
													>
														Preview
													</DropdownMenuItem>
													<DropdownMenuItem
														variant="destructive"
														onClick={() => {
															setOpenActionsId(null);
															setDeleteTarget(mcq);
														}}
													>
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			<Dialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
						setDeleteError(null);
					}
				}}
			>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Delete this question?</DialogTitle>
						<DialogDescription>
							This permanently removes &quot;{deleteTarget?.name}&quot; and all
							of its choices and attempts.
						</DialogDescription>
					</DialogHeader>
					{deleteError ? (
						<p className="text-sm text-destructive" role="alert">
							{deleteError}
						</p>
					) : null}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDeleteTarget(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleDeleteConfirm}
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete question"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
