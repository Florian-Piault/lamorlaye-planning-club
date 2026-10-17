import {
  ArrowLeftRight,
  CalendarDays,
  Clock,
  Info,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";

export interface NavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavigationSection {
  label: string;
  items: readonly NavigationItem[];
}

/** Sections de la barre latérale, dans l'ordre d'affichage (la dernière est calée en bas). */
export const navigationSections: readonly NavigationSection[] = [
  {
    label: "Planifier",
    items: [
      { path: "/planning", label: "Planning", icon: CalendarDays },
      { path: "/heures", label: "Heures", icon: Clock },
    ],
  },
  {
    label: "Gérer",
    items: [
      { path: "/referentiels", label: "Le club", icon: Users },
      { path: "/import-export", label: "Import/Export", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Application",
    items: [
      { path: "/reglages", label: "Réglages", icon: Settings },
      { path: "/a-propos", label: "À propos", icon: Info },
    ],
  },
];

/** Entrées de la barre latérale, dans l'ordre d'affichage. */
export const navigationItems: readonly NavigationItem[] = navigationSections.flatMap(
  (section) => section.items,
);
