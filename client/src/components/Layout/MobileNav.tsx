
import { Link, useLocation } from "wouter";
import { Search, Star, Calendar, User, Heart } from "lucide-react";

const NAV_ITEMS = [
  { icon: Search, label: "Search", href: "/" },
  { icon: Star, label: "Saved", href: "/saved" },
  { icon: Heart, label: "Favorites", href: "/favorites" },
  { icon: Calendar, label: "My Events", href: "/my-events" },
  { icon: User, label: "Account", href: "/profile" },
];

export default function MobileNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t h-16">
      <div className="grid grid-cols-5 gap-1 h-full">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <a className="flex flex-col items-center justify-center h-full">
                <Icon
                  className={`h-6 w-6 ${
                    isActive ? "text-primary" : "text-gray-500"
                  }`}
                />
                <span
                  className={`text-xs mt-1 ${
                    isActive ? "text-primary" : "text-gray-500"
                  }`}
                >
                  {item.label}
                </span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
