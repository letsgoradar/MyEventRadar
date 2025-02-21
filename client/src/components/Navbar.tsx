
import { useLocation } from "wouter";

export function Navbar() {
  const [, setLocation] = useLocation();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-around py-2">
          <button onClick={() => setLocation("/")} className="cursor-pointer">
            Map
          </button>
          <button onClick={() => setLocation("/search")} className="cursor-pointer">
            Search
          </button>
          <button onClick={() => setLocation("/favorites")} className="cursor-pointer">
            Favorites
          </button>
          <button onClick={() => setLocation("/profile")} className="cursor-pointer">
            Profile
          </button>
        </div>
      </div>
    </nav>
  );
}
