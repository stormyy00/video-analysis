import { Link } from "@tanstack/react-router";
import { CircleX } from "lucide-react";
import { Button } from "./ui/button";

export function DefaultNotFound() {
	return (
		<div className="flex h-screen w-full flex-col items-center justify-center bg-white dark:bg-black">
			<CircleX className="mb-4 size-16 text-ucr-blue dark:text-ucr-gold" />
			<p className="text-3xl font-bold text-ucr-blue dark:text-ucr-gold">
				404 - Page Not Found
			</p>
			<p className="mt-2 text-gray-600 dark:text-gray-400">
				The page you are looking for does not exist.
			</p>
			<div className="mt-6 flex flex-wrap items-center gap-4">
				<Button
					type="button"
					className="bg-ucr-blue hover:bg-ucr-blue dark:bg-ucr-gold dark:hover:bg-ucr-gold text-white"
					onClick={() => window.history.back()}
				>
					Go back
				</Button>
				<Button variant="secondary" asChild>
					<Link to="/">Home</Link>
				</Button>
			</div>
		</div>
	);
}
