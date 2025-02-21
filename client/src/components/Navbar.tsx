import Link from 'next/link';

function Navbar({ links }) {
  return (
    <nav className="bg-gray-800">
      <ul className="flex justify-center">
        {links.map((link) => (
          <li key={link.href} className="mx-4">
            <Link href={link.href} className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg">
              {link.icon && <link.icon className="w-4 h-4" />}
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default Navbar;