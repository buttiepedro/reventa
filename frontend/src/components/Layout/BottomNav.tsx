import { NavLink } from "react-router-dom";
import { useAudience } from "@/context/AudienceContext";
import { navItems } from "./navItems";

export function BottomNav() {
  const { isClientMode } = useAudience();
  const visibleTabs = isClientMode ? navItems.filter((t) => t.to === "/mercado") : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white/92 backdrop-blur-md safe-area-pb lg:hidden">
      <div className="mx-auto flex h-[68px] max-w-2xl items-stretch pt-2">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className="flex flex-1 flex-col items-center justify-start gap-1.5 pt-0.5 transition-transform duration-100 active:scale-[0.97]"
          >
            {({ isActive }) => (
              <>
                {tab.icon(`h-[18px] w-[18px] ${isActive ? "text-brand" : "text-faint"}`)}
                <span
                  className={`text-[10px] font-medium leading-none ${isActive ? "text-brand" : "text-faint"}`}
                >
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
