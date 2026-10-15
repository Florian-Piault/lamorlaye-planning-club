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

/** Entrées de la barre latérale, dans l'ordre d'affichage. */
export const navigationItems: readonly NavigationItem[] = [
  { path: "/planning", label: "Planning", icon: CalendarDays },
  { path: "/heures", label: "Heures", icon: Clock },
  { path: "/referentiels", label: "Référentiels", icon: Users },
  { path: "/import-export", label: "Import/Export", icon: ArrowLeftRight },
  { path: "/reglages", label: "Réglages", icon: Settings },
  { path: "/a-propos", label: "À propos", icon: Info },
];
