import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent/20 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Casino-specific variants
        casino: "bg-gradient-to-b from-primary via-primary/90 to-primary/80 text-primary-foreground font-display uppercase tracking-wider shadow-neon-gold hover:shadow-[0_0_30px_hsl(43_100%_50%/0.7)] border-2 border-primary/50",
        lever: "bg-gradient-to-b from-red-600 via-red-700 to-red-800 text-white font-display uppercase tracking-wider shadow-lg hover:from-red-500 hover:via-red-600 hover:to-red-700 border-4 border-red-400/50 rounded-full",
        neon: "bg-transparent border-2 border-neon-pink text-neon-pink shadow-neon-pink hover:bg-neon-pink/10 font-display uppercase tracking-wider",
        chrome: "chrome-effect text-gray-900 font-semibold border-2 border-gray-400 shadow-lg hover:brightness-110",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-14 rounded-lg px-10 text-lg",
        icon: "h-9 w-9",
        lever: "h-20 w-20",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
