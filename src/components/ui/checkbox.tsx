import * as React from "react";
import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return <input type="checkbox" className={cn("h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500", className)} {...props} />;
}

export { Checkbox };
