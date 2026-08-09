import type { ReactNode } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: (cls: string) => ReactNode;
}

const svg = (cls: string, children: ReactNode) => (
  <svg
    className={cls}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** Primary tabs — shared by the desktop rail and the mobile bottom nav. */
export const navItems: NavItem[] = [
  {
    to: "/inicio",
    label: "Inicio",
    icon: (cls) => svg(cls, <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />),
  },
  {
    to: "/lonja",
    label: "La Lonja",
    icon: (cls) =>
      svg(
        cls,
        <>
          <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
          <path d="M9 3.5h6v3H9zM8.5 11h7M8.5 15h4.5" />
        </>,
      ),
  },
  {
    to: "/mercado",
    label: "Mercado",
    icon: (cls) =>
      svg(
        cls,
        <>
          <path d="M4 8.5 5.2 5h13.6L20 8.5M4 8.5h16M4 8.5v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-10" />
          <path d="M9 12.5h6" />
        </>,
      ),
  },
  {
    to: "/tasador",
    label: "Tasador",
    icon: (cls) =>
      svg(
        cls,
        <>
          <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
          <path d="M8 7h8M8 11h2M12 11h2M15.5 11h.5M8 14.5h2M12 14.5h2M15.5 14.5h.5M8 18h2M12 18h4" />
        </>,
      ),
  },
  {
    to: "/agencia",
    label: "Mi Agencia",
    icon: (cls) =>
      svg(
        cls,
        <>
          <path d="M4 21V8l8-5 8 5v13" />
          <path d="M9 21v-5h6v5M9 11h.01M15 11h.01" />
        </>,
      ),
  },
];

/** Secondary rail actions (desktop only). */
export const railSecondary: NavItem[] = [
  {
    to: "/vehicles/my",
    label: "Mi stock",
    icon: (cls) =>
      svg(cls, <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5ZM4 12l8 3.5L20 12M4 16.5 12 20l8-3.5" />),
  },
  {
    to: "/vehicles/new",
    label: "Publicar vehículo",
    icon: (cls) =>
      svg(cls, <path d="M12 5v14M5 12h14" />),
  },
];
