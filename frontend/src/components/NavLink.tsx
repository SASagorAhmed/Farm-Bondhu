import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const toPath = typeof to === "string" ? to : to.pathname || "";
    const triggerPrefetch = () => {
      if (!toPath || typeof window === "undefined") return;
      window.dispatchEvent(new CustomEvent("farmbondhu:prefetch-route", { detail: toPath }));
    };

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        onMouseEnter={triggerPrefetch}
        onFocus={triggerPrefetch}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
