import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Simplistic class resolution since we don't have class-variance-authority installed yet
    let baseClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 "
    
    // Variants
    if (variant === "default") baseClass += "bg-primary text-primary-foreground hover:bg-primary/90 "
    if (variant === "destructive") baseClass += "bg-destructive text-destructive-foreground hover:bg-destructive/90 "
    if (variant === "outline") baseClass += "border border-input bg-background hover:bg-accent hover:text-accent-foreground "
    if (variant === "secondary") baseClass += "bg-secondary text-secondary-foreground hover:bg-secondary/80 "
    if (variant === "ghost") baseClass += "hover:bg-accent hover:text-accent-foreground "
    if (variant === "link") baseClass += "text-primary underline-offset-4 hover:underline "
    
    // Sizes
    if (size === "default") baseClass += "h-10 px-4 py-2 "
    if (size === "sm") baseClass += "h-9 rounded-md px-3 "
    if (size === "lg") baseClass += "h-11 rounded-md px-8 "
    if (size === "icon") baseClass += "h-10 w-10 "
    
    if (className) baseClass += className

    return (
      <Comp
        className={baseClass}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
